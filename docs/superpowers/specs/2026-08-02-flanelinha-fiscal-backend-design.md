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
Task<Flanelinha?> GetByIdWithCarterinhasAsync(int id, CancellationToken ct = default);
Task<Carterinha?> GetCarterinhaAtivaAsync(int idFlanel, CancellationToken ct = default);
Task AddCarterinhaAsync(Carterinha carterinha, CancellationToken ct = default);
Task<int> GetProximoNumeroCarterinhaAsync(CancellationToken ct = default);
```

`IFiscalRepository` não adiciona métodos além da base (por ora).

Controllers passam a receber `IFlanelinhaRepository` / `IFiscalRepository` via injeção de
construtor, no lugar de `ApplicationDBContext`.

## 3. DTOs

Namespaces seguem a convenção existente (`Dtos/Flanelinha`, `Dtos/Fiscal`).

- `UpdatePerfilDto { string Nome; string Email; }` (uma cópia em cada namespace).
- `ChangePasswordDto { string? SenhaAtual; string NovaSenha; }`
  - Flanelinha: `SenhaAtual` é ignorado/opcional quando `flanelinha.PrimeiroAcesso == true`.
  - Fiscal: `SenhaAtual` é sempre obrigatório.
- `RequestCarteiraDto { string? Motivo; }` (namespace `Dtos/Flanelinha`).
- `CarterinhaDto { int IdCarterinha; int NumeroCarterinha; DateTime DataEmissao; DateTime DataValidade; bool Ativo; TipoCarterinha Tipo; }`
  (namespace `Dtos/Flanelinha`, usado tanto na resposta do novo endpoint quanto substituindo
  `List<Carterinha>` em `FlanelinhaDto.Carterinhas`).

`FlanelinhaDto` e `FiscalDto` continuam sem o campo `Senha` (já era assim).

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

## 5. Hash de senha

- Pacote NuGet `BCrypt.Net-Next` adicionado ao `api.csproj`.
- `Create` (Flanelinha e Fiscal): grava `BCrypt.Net.BCrypt.HashPassword(dto.Senha)` em vez do
  texto puro.
- Endpoints de senha: verificam com `BCrypt.Net.BCrypt.Verify(senhaAtual, entity.Senha)` quando
  aplicável, e gravam `BCrypt.Net.BCrypt.HashPassword(dto.NovaSenha)`.
- Ao trocar a senha do Flanelinha com sucesso, `PrimeiroAcesso` é definido como `false`.

## 6. Regra de negócio: nova carteira

`POST /api/flanelinha/{id}/carteiras`:

1. Busca o Flanelinha por `id` — `404 NotFound` se não existir.
2. Busca a carteira ativa atual (`Ativo == true`) via `GetCarterinhaAtivaAsync`.
3. Se existir e `DataValidade > DateTime.UtcNow` → `400 BadRequest` ("carteira ainda válida").
4. Caso contrário:
   - Se existir uma carteira ativa vencida, marca `Ativo = false` nela.
   - Calcula `NumeroCarterinha` = `GetProximoNumeroCarterinhaAsync()` (máximo atual + 1, ou 1 se
     não houver nenhuma).
   - `Tipo` = `PrimeiraVia` se o Flanelinha nunca teve nenhuma carteira, senão `SegundaVia`.
   - Cria nova `Carterinha` com `DataEmissao = UtcNow`, `DataValidade = UtcNow.AddYears(1)`,
     `Ativo = true`.
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
