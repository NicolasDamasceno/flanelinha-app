# Design: Repository Pattern + Perfil/Senha/Carteira Endpoints (Flanelinha & Fiscal)

## Contexto

A API precisa suportar operações offline do Fiscal (armazenamento local que sincroniza quando a
conexão é restabelecida). Todos os fluxos de persistência devem usar o padrão Repository e I/O
assíncrono (`async`/`await`, `CancellationToken`).

Hoje `FlanelinhaController` e `FiscalController` acessam `ApplicationDBContext` diretamente, de
forma síncrona, e retornam entidades de domínio cruas (incluindo o campo `Senha`) direto no JSON.
`FiscalController.Update` também tem um bug pré-existente: altera as propriedades da entidade mas
nunca chama `SaveChanges()`, então não persiste nada.

## Decisões confirmadas com o usuário

1. **Email no Flanelinha**: o modelo `Flanelinha` não tem campo `Email` hoje. Será adicionada uma
   migration incluindo `string Email` no modelo, para que o endpoint de atualização de perfil
   (`Nome` + `Email`) funcione igual para Flanelinha e Fiscal.
2. **Primeiro acesso só para Flanelinha**: `Fiscal` não ganha campo `PrimeiroAcesso`. Fiscais são
   cadastrados já com senha definitiva; o endpoint de senha do Fiscal sempre exige a senha atual
   (fluxo de reset convencional apenas).
3. **Hash de senha (BCrypt) a partir de agora**: os novos endpoints de troca/reset de senha (e os
   endpoints de `Create` de Flanelinha/Fiscal, já que estão sendo tocados) passam a gravar hash
   BCrypt. Registros já gravados em texto puro antes desta mudança **não** são migrados/rehashed
   — fora do escopo desta tarefa.
4. **Validação de vencimento na emissão de nova carteira**: o endpoint de solicitação de nova
   carteira só permite emitir uma 2ª via se a carteira ativa atual já está vencida (`DataValidade`
   no passado) ou se o Flanelinha ainda não possui nenhuma carteira (1ª via). Caso contrário,
   retorna `400 BadRequest`.

## 1. Alterações de modelo (novas migrations)

- `Models/Flanelinha.cs`: adicionar `public string Email {get; set;} = string.Empty;`
- Nova migration (`FlanelinhaEmail`) refletindo essa alteração.
- `Fiscal` permanece sem alterações de schema.

## 2. Camada de Repository

```
Interfaces/
  IRepository.cs            // interface genérica IRepository<T>
  IFlanelinhaRepository.cs  // : IRepository<Flanelinha>
  IFiscalRepository.cs      // : IRepository<Fiscal>

Repositories/
  RepositoryBase.cs         // abstract class RepositoryBase<T> : IRepository<T>, implementação EF Core
  FlanelinhaRepository.cs   // : RepositoryBase<Flanelinha>, IFlanelinhaRepository
  FiscalRepository.cs       // : RepositoryBase<Fiscal>, IFiscalRepository
```

`IRepository<T>` (métodos que tocam o banco são assíncronos e recebem `CancellationToken`):

```csharp
Task<List<T>> GetAllAsync(CancellationToken ct = default);
Task<T?> GetByIdAsync(int id, CancellationToken ct = default);
Task AddAsync(T entity, CancellationToken ct = default);
void Update(T entity);
void Delete(T entity);
Task<bool> SaveChangesAsync(CancellationToken ct = default);
```

`IFlanelinhaRepository` adiciona:

```csharp
Task<List<Flanelinha>> GetAllWithCarterinhasAsync(CancellationToken ct = default);
Task<Flanelinha?> GetByIdWithCarterinhasAsync(int id, CancellationToken ct = default);
Task<Carterinha?> GetCarterinhaAtivaAsync(int idFlanel, CancellationToken ct = default);
Task AddCarterinhaAsync(Carterinha carterinha, CancellationToken ct = default);
Task<int> GetProximoNumeroCarterinhaAsync(CancellationToken ct = default);
```

A base `IRepository<T>.GetAllAsync`/`GetByIdAsync` **não** fazem `.Include(Carterinhas)` (não há
pacote de lazy-loading proxies no `api.csproj`, e não seria apropriado adicionar um agora). Como
`FlanelinhaController.GetAll`/`GetById` precisam popular `FlanelinhaDto.Carterinhas`, eles usam
`GetAllWithCarterinhasAsync`/`GetByIdWithCarterinhasAsync` (com `.Include(f => f.Carterinhas)`),
**não** os métodos genéricos da base — do contrário `Carterinhas` viria sempre `[]` na resposta.

`IFiscalRepository` não adiciona métodos além da base (por ora).

Controllers passam a receber `IFlanelinhaRepository` / `IFiscalRepository` via injeção de
construtor, no lugar de `ApplicationDBContext`.

## 3. DTOs

Namespaces seguem a convenção existente (`Dtos/Flanelinha`, `Dtos/Fiscal`).

- `UpdatePerfilDto { string Nome; string Email; }` (uma cópia em cada namespace).
- `ChangePasswordDto { string? SenhaAtual; string NovaSenha; }`
  - Flanelinha: `SenhaAtual` é ignorado/opcional quando `flanelinha.PrimeiroAcesso == true`.
  - Fiscal: `SenhaAtual` é sempre obrigatório.
- `RequestCarteiraDto { }` — corpo vazio por enquanto (nenhum campo de entrada é necessário: o
  servidor decide `Tipo` e `NumeroCarterinha`). Existe como tipo dedicado para não expor a
  entidade `Carterinha` e para dar espaço a campos futuros (ex.: motivo), mas não inventamos campos
  não utilizados agora.
- `CarterinhaDto { int IdCarterinha; int NumeroCarterinha; DateTime DataEmissao; DateTime DataValidade; bool Ativo; TipoCarterinha Tipo; }`
  (namespace `Dtos/Flanelinha`, usado tanto na resposta do novo endpoint quanto substituindo
  `List<Carterinha>` em `FlanelinhaDto.Carterinhas`).

**Correções necessárias em DTOs/mappers existentes (achadas na revisão da spec):**

- `CreateFlanelinhaDto` e `FlanelinhaDto` não têm campo `Email` — precisam ganhar
  `string Email {get; set;}` para ter paridade com o Fiscal (que já tem `Email` ponta a ponta).
- `FlanelinhaDto.Telefone` está tipado como `int`, mas `Flanelinha.Telefone` é `string` (desde a
  migration `FlanelinhaTelefone`). Corrigir `FlanelinhaDto.Telefone` para `string`.
- `FlanelinhaMappers.ToFlanelinhaDto` hoje tem assinatura `Flanelinha ToFlanelinhaDto(this Flanelinha)`
  — ou seja, apesar do nome, devolve outra instância de `Flanelinha` (não um `FlanelinhaDto`), e
  por isso nunca é usado para remover o `Senha` da resposta. Ele será corrigido para
  `FlanelinhaDto ToFlanelinhaDto(this Flanelinha flanelinhaModel)`, mapeando para o DTO de fato
  (incluindo `Email`, `Telefone` como `string`, e `Carterinhas` como `List<CarterinhaDto>` via
  `.Select(c => c.ToCarterinhaDto()).ToList()`).
- `FlanelinhaController.GetAll`/`GetById` (hoje retornam `Flanelinha` cru) e `FiscalController.GetAll`/
  `GetById` (já retornam `Fiscal` cru) passam a mapear para `FlanelinhaDto`/`FiscalDto` antes de
  retornar, fechando o vazamento do campo `Senha` no JSON de resposta.
- `ToCarterinhaDto()` (usado acima) é um novo método de extensão `CarterinhaDto ToCarterinhaDto(this Carterinha carterinhaModel)`,
  definido em `Mappers/FlanelinhaMappers.cs` (não há um `CarterinhaMappers.cs` separado — a
  entidade `Carterinha` só é exposta a partir do fluxo de Flanelinha, então fica no mesmo arquivo).

## 4. Endpoints

| Método | Rota | DTO de entrada | Resposta |
|---|---|---|---|
| PUT | `/api/flanelinha/{id}/perfil` | `UpdatePerfilDto` | `200 OK` (`FlanelinhaDto`) / `404 NotFound` |
| PUT | `/api/fiscal/{id}/perfil` | `UpdatePerfilDto` | `200 OK` (`FiscalDto`) / `404 NotFound` |
| PUT | `/api/flanelinha/{id}/senha` | `ChangePasswordDto` | `204 NoContent` / `400 BadRequest` / `404 NotFound` |
| PUT | `/api/fiscal/{id}/senha` | `ChangePasswordDto` | `204 NoContent` / `400 BadRequest` / `404 NotFound` |
| POST | `/api/flanelinha/{id}/carteiras` | `RequestCarteiraDto` | `201 Created` (`CarterinhaDto`) / `400 BadRequest` / `404 NotFound` |

Endpoints existentes (`GetAll`, `GetById`, `Create`, `Delete` em ambos os controllers, e `Update`
em `FiscalController`) são refatorados para usar os repositórios de forma assíncrona e retornar
DTOs. O `Update` genérico de `FiscalController` (que tinha o bug de não salvar) é removido/
substituído pelos dois endpoints dedicados (`perfil` e `senha`), conforme pedido pela tarefa.
`UpdateFiscalDto` fica órfão nessa troca e é removido junto (`Dtos/Fiscal/UpdateFiscalDto.cs`).

## 5. Hash de senha

- Pacote NuGet `BCrypt.Net-Next` adicionado ao `api.csproj`.
- `Create` (Flanelinha e Fiscal): grava `BCrypt.Net.BCrypt.HashPassword(dto.Senha)` em vez do
  texto puro.
- Endpoints de senha: verificam com `BCrypt.Net.BCrypt.Verify(senhaAtual, entity.Senha)` quando
  aplicável, e gravam `BCrypt.Net.BCrypt.HashPassword(dto.NovaSenha)`.
- Ao trocar a senha do Flanelinha com sucesso, `PrimeiroAcesso` é definido como `false`.
- **Registros legados em texto puro (achado na revisão da spec):** `BCrypt.Verify` lança
  `SaltParseException` se `entity.Senha` não for um hash bcrypt válido (o caso de qualquer registro
  gravado antes desta mudança). A verificação de `SenhaAtual` deve envolver a chamada a `Verify`
  em um helper que capture essa exceção e trate como "senha não confere" (→ `400 BadRequest`), em
  vez de deixar a exceção propagar como erro 500. Isso é necessário tanto para Flanelinha quanto
  para Fiscal, já que ambos podem ter registros pré-existentes em texto puro.

## 6. Regra de negócio: nova carteira

`POST /api/flanelinha/{id}/carteiras`:

1. Busca o Flanelinha por `id` usando `GetByIdWithCarterinhasAsync` (inclui todo o histórico de
   carterinhas, necessário para decidir `Tipo` no passo 4) — `404 NotFound` se não existir.
2. A partir da lista já carregada, seleciona a carteira ativa atual: `Carterinhas.Where(c => c.Ativo).OrderByDescending(c => c.DataEmissao).FirstOrDefault()`.
   (`GetCarterinhaAtivaAsync` no repositório implementa essa mesma query diretamente no banco,
   para uso fora deste fluxo; aqui reaproveitamos a lista já carregada para evitar um round-trip
   extra.) Invariante do sistema: no máximo uma carteira `Ativo == true` por Flanelinha a qualquer
   momento — garantida porque este é o único fluxo que cria carterinhas, e ele sempre desativa a
   anterior antes de ativar a nova. `OrderByDescending(DataEmissao).FirstOrDefault()` é uma
   salvaguarda, não o mecanismo principal.
3. Se existir carteira ativa e `DataValidade > DateTime.UtcNow` → `400 BadRequest` ("carteira
   ainda válida"). Vencimento exatamente igual a `DateTime.UtcNow` (empate) conta como vencida
   (permite emissão) — a condição de bloqueio é estritamente `DataValidade > UtcNow`.
4. Caso contrário:
   - Se existir uma carteira ativa vencida, marca `Ativo = false` nela.
   - Calcula `NumeroCarterinha` = `GetProximoNumeroCarterinhaAsync()` (máximo atual + 1 entre
     *todas* as carterinhas do sistema, ou 1 se não houver nenhuma — numeração global, não por
     Flanelinha).
   - `Tipo` = `PrimeiraVia` se `Carterinhas.Count == 0` (Flanelinha nunca teve nenhuma carteira,
     ativa ou não), senão `SegundaVia`.
   - Cria nova `Carterinha` com `IdFlanel = id`, `DataEmissao = UtcNow`,
     `DataValidade = UtcNow.AddYears(1)`, `Ativo = true`, persistida via `AddCarterinhaAsync`.
5. Retorna `201 Created` com `CarterinhaDto` da nova carteira.

## 7. Wiring (Program.cs)

```csharp
builder.Services.AddScoped<IFlanelinhaRepository, FlanelinhaRepository>();
builder.Services.AddScoped<IFiscalRepository, FiscalRepository>();
```

## Fora de escopo

- Migração/rehash de senhas em texto puro já existentes no banco.
- Autenticação/login (JWT ou sessão) — os endpoints de senha assumem que o chamador já identificou
  o Flanelinha/Fiscal pelo `id` na rota; não há endpoint de login nesta tarefa.
- Notificação (e-mail/push) ao Flanelinha sobre a emissão da nova carteira.
