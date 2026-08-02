# Design: Endpoint de Login (JWT) e proteção dos endpoints existentes

## Contexto

O app mobile (React Native) terá uma tela de login única para Fiscal e Flanelinha, cuja resposta
define o tipo de perfil e a navegação subsequente. Hoje a API não tem nenhum endpoint de
autenticação — foi explicitamente deixado fora de escopo na spec anterior
(`2026-08-02-flanelinha-fiscal-backend-design.md`, seção "Fora de escopo"). Além disso, nenhum
endpoint existente exige token: qualquer chamada com um `{id}` na rota funciona sem autenticação.

Este é o primeiro de quatro sub-projetos da camada de frontend mobile (auth backend → scaffold +
design system + navegação → fluxo Fiscal → fluxo Flanelinha). Os demais serão especificados em
specs separadas.

## Decisões confirmadas com o usuário

1. **Identificador de login**: CPF (não e-mail) — ambas entidades já têm `Cpf` único.
2. **Resolução de perfil**: endpoint único `POST /api/auth/login`. Busca o CPF em `Fiscal`
   primeiro; se não encontrar, busca em `Flanelinha`.
3. **Escopo da autenticação**: além de emitir o token, esta spec também protege com `[Authorize]`
   todos os endpoints existentes de `FiscalController`/`FlanelinhaController`.
4. **`POST/GET /api/fiscal`**: não têm tela associada no app (não existe cadastro de Fiscal via
   mobile). Ficam protegidos apenas com `[Authorize(Roles = "Fiscal")]` genérico (qualquer Fiscal
   autenticado), sem verificação de dono — uso administrativo via Scalar/Postman.
5. **Sem testes automatizados**: o projeto não tem projeto de testes hoje (nem para os
   controllers existentes). Verificação desta spec é manual via Scalar, seguindo a convenção atual.

## 1. Endpoint de login

Novo `AuthController`:

```
POST /api/auth/login
Body:    LoginDto { string Cpf; string Senha; }
200 OK:  LoginResponseDto {
           string Token;
           string TipoPerfil;      // "Fiscal" | "Flanelinha"
           bool PrimeiroAcesso;    // sempre false para Fiscal
           object Perfil;          // FiscalDto ou FlanelinhaDto
         }
401 Unauthorized: CPF não encontrado em nenhuma tabela, ou senha não confere
400 BadRequest: Cpf/Senha ausentes (validação de LoginDto via DataAnnotations)
```

`LoginDto` segue a convenção de `CreateFlanelinhaDto` (`[Required]` em `Cpf` e `Senha`).

Lógica do controller (`Dtos/Auth/LoginDto.cs`, `Dtos/Auth/LoginResponseDto.cs`,
namespace `api.Dtos.Auth`):

1. `fiscal = await _fiscalRepository.GetByCpfAsync(dto.Cpf, ct)`.
   - Se achou: valida senha com `PasswordHasher.Verify(dto.Senha, fiscal.Senha)`. Se ok, gera token
     com role `"Fiscal"`, `sub = fiscal.IdFiscal`, retorna `TipoPerfil = "Fiscal"`,
     `PrimeiroAcesso = false`, `Perfil = fiscal.ToFiscalDto()`.
   - Se a senha não confere → `401`.
2. Se não achou Fiscal: `flanelinha = await _flanelinhaRepository.GetByCpfAsync(dto.Cpf, ct)`.
   - Se achou e senha confere: gera token com role `"Flanelinha"`, `sub = flanelinha.IdFlanel`,
     `TipoPerfil = "Flanelinha"`, `PrimeiroAcesso = flanelinha.PrimeiroAcesso`,
     `Perfil = flanelinha.ToFlanelinhaDto()`.
   - Senão → `401`.
3. Se nenhum CPF encontrado em nenhuma tabela → `401` (mesma mensagem genérica do passo 1/2 —
   "CPF ou senha inválidos" — para não vazar qual CPF existe no sistema).

Novos métodos de repositório (adicionados a `IFiscalRepository`/`IFlanelinhaRepository`, implementados
em `FiscalRepository`/`FlanelinhaRepository` via EF Core):

```csharp
Task<Fiscal?> GetByCpfAsync(string cpf, CancellationToken ct = default);
Task<Flanelinha?> GetByCpfAsync(string cpf, CancellationToken ct = default);
```

## 2. Geração e configuração do JWT

Novo `Security/JwtTokenGenerator.cs` (ou similar), responsável por criar o token a partir de
`(id, role, nome)`. Claims:

- `ClaimTypes.NameIdentifier` = id (`IdFiscal` ou `IdFlanel`) como string.
- `ClaimTypes.Role` = `"Fiscal"` ou `"Flanelinha"`.
- Claim custom `"nome"` = nome do perfil (evita round-trip no app só para exibir o nome).

Configuração em `appsettings.json` (seção `Jwt`):

```json
"Jwt": {
  "Key": "<segredo>",
  "Issuer": "flanelinha-api",
  "Audience": "flanelinha-app",
  "ExpiresInMinutes": 480
}
```

`appsettings.Development.json` recebe uma chave de desenvolvimento; a chave de produção deve vir de
variável de ambiente/secret manager (fora do escopo desta spec — só a leitura via `IConfiguration`
é implementada aqui).

Expiração: 8 horas, sem refresh token. Token expirado → app volta para a tela de login (tratado no
frontend, fora do escopo desta spec de backend).

Pacote novo: `Microsoft.AspNetCore.Authentication.JwtBearer` (versão compatível com `net9.0`).

`Program.cs` ganha:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => { /* TokenValidationParameters a partir de Jwt:* */ });
builder.Services.AddAuthorization();
...
app.UseAuthentication();
app.UseAuthorization(); // já existe
```

## 3. Proteção dos endpoints existentes

| Endpoint | Regra |
|---|---|
| `GET /api/fiscal`, `GET /api/fiscal/{id}`, `POST /api/fiscal` | `[Authorize(Roles = "Fiscal")]` |
| `DELETE /api/fiscal/{id}` | `[Authorize(Roles = "Fiscal")]` |
| `PUT /api/fiscal/{id}/perfil`, `PUT /api/fiscal/{id}/senha` | `[Authorize(Roles = "Fiscal")]` + checagem `id == NameIdentifier do token` → `403 Forbid()` se não bater |
| `POST /api/flanelinha`, `DELETE /api/flanelinha/{id}` | `[Authorize(Roles = "Fiscal")]` |
| `GET /api/flanelinha` | `[Authorize(Roles = "Fiscal")]` — passa a filtrar por `IdFiscal == NameIdentifier do token` (ver seção 4) |
| `GET /api/flanelinha/{id}` | `[Authorize(Roles = "Fiscal")]` — `403 Forbid()` se `flanelinha.IdFiscal != NameIdentifier do token` |
| `PUT /api/flanelinha/{id}/perfil`, `PUT /api/flanelinha/{id}/senha`, `POST /api/flanelinha/{id}/carteiras` | `[Authorize(Roles = "Flanelinha")]` + checagem `id == NameIdentifier do token` → `403 Forbid()` se não bater |

Padrão de checagem de dono (repetido nos endpoints acima): comparar
`User.FindFirstValue(ClaimTypes.NameIdentifier)` (convertido para `int`) com o `id` da rota (ou
`flanelinha.IdFiscal`, no caso de `GetById`), retornando `Forbid()` quando não bate — antes de
qualquer alteração de estado.

## 4. Mudança de comportamento: listagem de Flanelinhas por Fiscal

A spec do app mobile exige que a "Tela de Visualização / Consulta de Flanelinhas" do Fiscal liste
"exclusivamente" os flanelinhas cadastrados por aquele Fiscal. Hoje `FlanelinhaController.GetAll`
retorna todos os flanelinhas do sistema, sem filtro.

`GetAll` passa a exigir o token do Fiscal autenticado e filtrar por `IdFiscal`. Novo método de
repositório:

```csharp
Task<List<Flanelinha>> GetAllByFiscalWithCarterinhasAsync(int idFiscal, CancellationToken ct = default);
```

(mesma implementação de `GetAllWithCarterinhasAsync`, adicionando `.Where(f => f.IdFiscal == idFiscal)`).
`GetAllWithCarterinhasAsync` sem filtro é removido do controller (não há mais chamador — mantido na
interface apenas se algum outro fluxo precisar futuramente; caso contrário, removido também da
interface por não ter uso).

## 5. Tratamento de erro

- `401 Unauthorized`: login com CPF/senha inválidos; ou requisição sem token/token expirado/token
  inválido em endpoint protegido (tratado automaticamente pelo middleware JWT).
- `403 Forbidden`: token válido, mas role ou dono (`id`) não autoriza a ação.
- `400 BadRequest`: `LoginDto` com `Cpf`/`Senha` vazios (`ModelState` via `[Required]`).

## 6. Verificação

Sem projeto de testes automatizados (consistente com o restante do código). Verificação manual via
Scalar (`/scalar`) ou curl:

- Login com CPF/senha válidos de Fiscal → `200` com `TipoPerfil = "Fiscal"`.
- Login com CPF/senha válidos de Flanelinha (`PrimeiroAcesso = true`) → `200` com
  `TipoPerfil = "Flanelinha"`, `PrimeiroAcesso = true`.
- Login com CPF inexistente ou senha errada → `401`.
- `GET /api/flanelinha` sem token → `401`. Com token de Fiscal → `200`, só flanelinhas daquele
  fiscal. Com token de Flanelinha → `403` (role errada).
- `PUT /api/flanelinha/{id}/senha` com token de outro Flanelinha (`id` da rota ≠ `sub` do token) →
  `403`.
- `PUT /api/fiscal/{id}/perfil` com token de Flanelinha → `403` (role errada).

## Fora de escopo

- Refresh token / renovação de sessão.
- Gerenciamento de segredo do JWT em produção (variável de ambiente/secret manager) — só a leitura
  via `IConfiguration` é implementada.
- Rate limiting / bloqueio por tentativas de login.
- Projeto de testes automatizados.
- Endpoint de "logout" no backend (JWT é stateless; logout é só descartar o token no app — tratado
  no frontend).
- Tudo relacionado ao app mobile em si (scaffold, telas, navegação) — sub-projetos seguintes.
