# Auth Backend (JWT Login + Endpoint Protection) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `POST /api/auth/login` endpoint (CPF + senha → JWT) and protect every existing `FiscalController`/`FlanelinhaController` endpoint with `[Authorize]`, per the approved spec at `docs/superpowers/specs/2026-08-02-flanelinha-auth-backend-design.md`.

**Architecture:** New `AuthController` resolves a CPF against `Fiscal` first, then `Flanelinha`, verifies the password with the existing `PasswordHasher`, and issues a JWT via a new `JwtTokenGenerator` (claims: `NameIdentifier` = id, `Role` = `"Fiscal"`/`"Flanelinha"`, custom `nome` claim). ASP.NET Core's JWT Bearer middleware validates the token on every subsequent request. Existing controllers gain `[Authorize(Roles = ...)]` plus manual "does this id belong to the caller" checks where the spec requires per-resource ownership (`Forbid()` on mismatch). `FlanelinhaController.GetAll` changes behavior: it now scopes results to the authenticated Fiscal's own cadastros instead of returning every Flanelinha in the system, and `Create` assigns `IdFiscal` from the token instead of trusting the request body.

**Tech Stack:** ASP.NET Core 9 Web API, EF Core 9 (Npgsql), `Microsoft.AspNetCore.Authentication.JwtBearer`, `BCrypt.Net-Next` (existing).

**Testing approach:** No test project exists in this repo (confirmed in the spec — same decision carried over from the prior backend plan). Every task's verification step is `dotnet build`, plus a final manual-smoke-test task using Scalar (`/scalar`) or `curl`.

---

## Chunk 1: Full implementation

### Task 1: JWT package + configuration

**Files:**
- Modify: `api/api.csproj`
- Modify: `api/appsettings.json`

- [ ] **Step 1: Add the JWT Bearer package**

Run from `api/`:
```
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
```
Expected: `api.csproj` gains a `<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" ... />` line. This may print a `warning NU1608`/`SDK1080`-style "implicitly referenced by the .NET SDK" note — that's expected for a `Microsoft.NET.Sdk.Web` project and safe to ignore (per the spec, section 2).

- [ ] **Step 2: Add the `Jwt` config section**

In `api/appsettings.json`, add a `Jwt` section as a sibling of `ConnectionStrings` (this repo already commits dev-only secrets directly in `appsettings.json`, e.g. the Postgres password — the JWT signing key follows the same existing convention, per the spec's "Fora de escopo" on production secret management):

```json
{
  "ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Port=5432;Database=postgres-api-flanelinha-app;Username=postgres;Password=123"
  },
  "Jwt": {
    "Key": "flanelinha-app-dev-jwt-signing-key-2026-nao-usar-em-producao",
    "Issuer": "flanelinha-api",
    "Audience": "flanelinha-app",
    "ExpiresInMinutes": 480
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

- [ ] **Step 3: Build**

Run: `dotnet build`
Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add api/api.csproj api/appsettings.json
git commit -m "feat: add JWT Bearer package and Jwt config section"
```

---

### Task 2: `JwtTokenGenerator` + JWT middleware wiring

**Files:**
- Create: `api/Security/JwtTokenGenerator.cs`
- Modify: `api/Program.cs`

- [ ] **Step 1: Create the token generator**

Create `api/Security/JwtTokenGenerator.cs`:

```csharp
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace api.Security
{
    public class JwtTokenGenerator
    {
        private readonly IConfiguration _configuration;

        public JwtTokenGenerator(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public string GenerateToken(int id, string role, string nome)
        {
            var key = _configuration["Jwt:Key"]!;
            var issuer = _configuration["Jwt:Issuer"]!;
            var audience = _configuration["Jwt:Audience"]!;
            var expiresInMinutes = int.Parse(_configuration["Jwt:ExpiresInMinutes"]!);

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, id.ToString()),
                new Claim(ClaimTypes.Role, role),
                new Claim("nome", nome)
            };

            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
            var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(expiresInMinutes),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
```

- [ ] **Step 2: Wire DI + authentication/authorization middleware**

Replace the full contents of `api/Program.cs`:

```csharp
using System.Text;
using api.Data;
using api.Interfaces;
using api.Repositories;
using api.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

builder.Services.AddDbContext<ApplicationDBContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
});

builder.Services.AddScoped<IFlanelinhaRepository, FlanelinhaRepository>();
builder.Services.AddScoped<IFiscalRepository, FiscalRepository>();
builder.Services.AddSingleton<JwtTokenGenerator>();

var jwtKey = builder.Configuration["Jwt:Key"]!;
var jwtIssuer = builder.Configuration["Jwt:Issuer"]!;
var jwtAudience = builder.Configuration["Jwt:Audience"]!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

//app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

- [ ] **Step 3: Build**

Run: `dotnet build`
Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add api/Security/JwtTokenGenerator.cs api/Program.cs
git commit -m "feat: add JwtTokenGenerator and wire JWT authentication middleware"
```

---

### Task 3: `GetByCpfAsync` on both repositories

**Files:**
- Modify: `api/Interfaces/IFiscalRepository.cs`
- Modify: `api/Interfaces/IFlanelinhaRepository.cs`
- Modify: `api/Repositories/FiscalRepository.cs`
- Modify: `api/Repositories/FlanelinhaRepository.cs`

- [ ] **Step 1: `IFiscalRepository`**

Replace the full contents of `api/Interfaces/IFiscalRepository.cs`:

```csharp
using api.Models;

namespace api.Interfaces
{
    public interface IFiscalRepository : IRepository<Fiscal>
    {
        Task<Fiscal?> GetByCpfAsync(string cpf, CancellationToken ct = default);
    }
}
```

- [ ] **Step 2: `IFlanelinhaRepository`**

Replace the full contents of `api/Interfaces/IFlanelinhaRepository.cs`:

```csharp
using api.Models;

namespace api.Interfaces
{
    public interface IFlanelinhaRepository : IRepository<Flanelinha>
    {
        Task<Flanelinha?> GetByCpfAsync(string cpf, CancellationToken ct = default);
        Task<List<Flanelinha>> GetAllWithCarterinhasAsync(CancellationToken ct = default);
        Task<Flanelinha?> GetByIdWithCarterinhasAsync(int id, CancellationToken ct = default);
        Task<Carterinha?> GetCarterinhaAtivaAsync(int idFlanel, CancellationToken ct = default);
        Task AddCarterinhaAsync(Carterinha carterinha, CancellationToken ct = default);
        Task<int> GetProximoNumeroCarterinhaAsync(CancellationToken ct = default);
    }
}
```

(`GetAllWithCarterinhasAsync` is still here — it's swapped for the fiscal-scoped version in Task 7, not this task, to keep this task focused on one thing: adding CPF lookup.)

- [ ] **Step 3: `FiscalRepository`**

Replace the full contents of `api/Repositories/FiscalRepository.cs`:

```csharp
using api.Data;
using api.Interfaces;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Repositories
{
    public class FiscalRepository : RepositoryBase<Fiscal>, IFiscalRepository
    {
        public FiscalRepository(ApplicationDBContext context) : base(context)
        {
        }

        public async Task<Fiscal?> GetByCpfAsync(string cpf, CancellationToken ct = default)
        {
            return await _dbSet.FirstOrDefaultAsync(f => f.Cpf == cpf, ct);
        }
    }
}
```

- [ ] **Step 4: `FlanelinhaRepository`**

Replace the full contents of `api/Repositories/FlanelinhaRepository.cs`:

```csharp
using api.Data;
using api.Interfaces;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Repositories
{
    public class FlanelinhaRepository : RepositoryBase<Flanelinha>, IFlanelinhaRepository
    {
        public FlanelinhaRepository(ApplicationDBContext context) : base(context)
        {
        }

        public async Task<Flanelinha?> GetByCpfAsync(string cpf, CancellationToken ct = default)
        {
            return await _dbSet.FirstOrDefaultAsync(f => f.Cpf == cpf, ct);
        }

        public async Task<List<Flanelinha>> GetAllWithCarterinhasAsync(CancellationToken ct = default)
        {
            return await _dbSet.Include(f => f.Carterinhas).ToListAsync(ct);
        }

        public async Task<Flanelinha?> GetByIdWithCarterinhasAsync(int id, CancellationToken ct = default)
        {
            return await _dbSet
                .Include(f => f.Carterinhas)
                .FirstOrDefaultAsync(f => f.IdFlanel == id, ct);
        }

        public async Task<Carterinha?> GetCarterinhaAtivaAsync(int idFlanel, CancellationToken ct = default)
        {
            return await _context.Carterinhas
                .Where(c => c.IdFlanel == idFlanel && c.Ativo)
                .OrderByDescending(c => c.DataEmissao)
                .FirstOrDefaultAsync(ct);
        }

        public async Task AddCarterinhaAsync(Carterinha carterinha, CancellationToken ct = default)
        {
            await _context.Carterinhas.AddAsync(carterinha, ct);
        }

        public async Task<int> GetProximoNumeroCarterinhaAsync(CancellationToken ct = default)
        {
            var existeAlguma = await _context.Carterinhas.AnyAsync(ct);
            if (!existeAlguma)
            {
                return 1;
            }

            var maiorNumero = await _context.Carterinhas.MaxAsync(c => c.NumeroCarterinha, ct);
            return maiorNumero + 1;
        }
    }
}
```

- [ ] **Step 5: Build**

Run: `dotnet build`
Expected: `Build succeeded.`

- [ ] **Step 6: Commit**

```bash
git add api/Interfaces/IFiscalRepository.cs api/Interfaces/IFlanelinhaRepository.cs api/Repositories/FiscalRepository.cs api/Repositories/FlanelinhaRepository.cs
git commit -m "feat: add GetByCpfAsync to Fiscal and Flanelinha repositories"
```

---

### Task 4: Unique index on `Cpf`

**Files:**
- Modify: `api/Data/ApplicationDBContext.cs`

- [ ] **Step 1: Add the unique index config**

In `api/Data/ApplicationDBContext.cs`, add to `OnModelCreating` (after the existing `Carterinha` unique index config):

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<Flanelinha>()
        .HasMany(f => f.Carterinhas)
        .WithOne()
        .HasForeignKey(c => c.IdFlanel)
        .OnDelete(DeleteBehavior.Cascade);

    modelBuilder.Entity<Carterinha>()
        .HasIndex(c => c.NumeroCarterinha)
        .IsUnique();

    modelBuilder.Entity<Fiscal>()
        .HasIndex(f => f.Cpf)
        .IsUnique();

    modelBuilder.Entity<Flanelinha>()
        .HasIndex(f => f.Cpf)
        .IsUnique();
}
```

- [ ] **Step 2: Generate the migration**

Run from `api/`:
```
dotnet ef migrations add UniqueCpfIndex
```
Expected: new files `Migrations/<timestamp>_UniqueCpfIndex.cs` and `.Designer.cs`, and `ApplicationDBContextModelSnapshot.cs` updated with unique indexes on `Fiscal.Cpf` and `Flanelinha.Cpf`.

If this command fails with a duplicate-key-style error when later applied (Task 11) because the local dev database already has two rows sharing a `Cpf`, that's expected per the spec ("duplicatas pré-existentes devem ser limpas manualmente antes de aplicar a migration") — resolve by deleting/updating the offending row(s) in the local Postgres database, not by changing this migration.

- [ ] **Step 3: Build**

Run: `dotnet build`
Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add api/Data/ApplicationDBContext.cs api/Migrations/
git commit -m "feat: add unique index on Fiscal.Cpf and Flanelinha.Cpf"
```

---

### Task 5: `LoginDto` and `LoginResponseDto`

**Files:**
- Create: `api/Dtos/Auth/LoginDto.cs`
- Create: `api/Dtos/Auth/LoginResponseDto.cs`

- [ ] **Step 1: `LoginDto`**

Create `api/Dtos/Auth/LoginDto.cs`:

```csharp
using System.ComponentModel.DataAnnotations;

namespace api.Dtos.Auth
{
    public class LoginDto
    {
        [Required]
        public string Cpf { get; set; } = string.Empty;

        [Required]
        public string Senha { get; set; } = string.Empty;
    }
}
```

- [ ] **Step 2: `LoginResponseDto`**

Create `api/Dtos/Auth/LoginResponseDto.cs`:

```csharp
namespace api.Dtos.Auth
{
    public class LoginResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string TipoPerfil { get; set; } = string.Empty;
        public bool PrimeiroAcesso { get; set; }
        public object Perfil { get; set; } = null!;
    }
}
```

- [ ] **Step 3: Build**

Run: `dotnet build`
Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add api/Dtos/Auth/
git commit -m "feat: add LoginDto and LoginResponseDto"
```

---

### Task 6: `AuthController`

**Files:**
- Create: `api/Controllers/AuthController.cs`

- [ ] **Step 1: Create the controller**

Create `api/Controllers/AuthController.cs`:

```csharp
using api.Dtos.Auth;
using api.Interfaces;
using api.Mappers;
using api.Security;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers
{
    [Route("api/auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IFiscalRepository _fiscalRepository;
        private readonly IFlanelinhaRepository _flanelinhaRepository;
        private readonly JwtTokenGenerator _tokenGenerator;

        public AuthController(
            IFiscalRepository fiscalRepository,
            IFlanelinhaRepository flanelinhaRepository,
            JwtTokenGenerator tokenGenerator)
        {
            _fiscalRepository = fiscalRepository;
            _flanelinhaRepository = flanelinhaRepository;
            _tokenGenerator = tokenGenerator;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto, CancellationToken ct)
        {
            var fiscal = await _fiscalRepository.GetByCpfAsync(dto.Cpf, ct);
            if (fiscal != null)
            {
                if (!PasswordHasher.Verify(dto.Senha, fiscal.Senha))
                {
                    return Unauthorized("CPF ou senha inválidos.");
                }

                var token = _tokenGenerator.GenerateToken(fiscal.IdFiscal, "Fiscal", fiscal.Nome);
                return Ok(new LoginResponseDto
                {
                    Token = token,
                    TipoPerfil = "Fiscal",
                    PrimeiroAcesso = false,
                    Perfil = fiscal.ToFiscalDto()
                });
            }

            var flanelinha = await _flanelinhaRepository.GetByCpfAsync(dto.Cpf, ct);
            if (flanelinha != null)
            {
                if (!PasswordHasher.Verify(dto.Senha, flanelinha.Senha))
                {
                    return Unauthorized("CPF ou senha inválidos.");
                }

                var token = _tokenGenerator.GenerateToken(flanelinha.IdFlanel, "Flanelinha", flanelinha.Nome);
                return Ok(new LoginResponseDto
                {
                    Token = token,
                    TipoPerfil = "Flanelinha",
                    PrimeiroAcesso = flanelinha.PrimeiroAcesso,
                    Perfil = flanelinha.ToFlanelinhaDto()
                });
            }

            return Unauthorized("CPF ou senha inválidos.");
        }
    }
}
```

Note: `flanelinha.ToFlanelinhaDto()` reads `flanelinha.Carterinhas` — `GetByCpfAsync` does not `.Include(f => f.Carterinhas)` (it mirrors the plain `GetByIdAsync`, not `GetByIdWithCarterinhasAsync`), so `Perfil.carterinhas` in the login response is always `[]`, regardless of the Flanelinha's actual carteira history. This is intentional and consistent with the codebase's existing naming convention (plain methods don't include; `...WithCarterinhas` methods do) — the login response is for identifying the user, not for carteira data, which the mobile app fetches separately via `GET /api/flanelinha/{id}`.

- [ ] **Step 2: Build**

Run: `dotnet build`
Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add api/Controllers/AuthController.cs
git commit -m "feat: add POST /api/auth/login endpoint"
```

---

### Task 7: Swap `GetAllWithCarterinhasAsync` for a Fiscal-scoped version

**Files:**
- Modify: `api/Interfaces/IFlanelinhaRepository.cs`
- Modify: `api/Repositories/FlanelinhaRepository.cs`

This task intentionally breaks the build — `FlanelinhaController.GetAll` (not yet updated) still calls the method being removed here. That's expected and resolved in Task 9.

- [ ] **Step 1: `IFlanelinhaRepository`**

Replace the full contents of `api/Interfaces/IFlanelinhaRepository.cs`:

```csharp
using api.Models;

namespace api.Interfaces
{
    public interface IFlanelinhaRepository : IRepository<Flanelinha>
    {
        Task<Flanelinha?> GetByCpfAsync(string cpf, CancellationToken ct = default);
        Task<List<Flanelinha>> GetAllByFiscalWithCarterinhasAsync(int idFiscal, CancellationToken ct = default);
        Task<Flanelinha?> GetByIdWithCarterinhasAsync(int id, CancellationToken ct = default);
        Task<Carterinha?> GetCarterinhaAtivaAsync(int idFlanel, CancellationToken ct = default);
        Task AddCarterinhaAsync(Carterinha carterinha, CancellationToken ct = default);
        Task<int> GetProximoNumeroCarterinhaAsync(CancellationToken ct = default);
    }
}
```

- [ ] **Step 2: `FlanelinhaRepository`**

Replace the full contents of `api/Repositories/FlanelinhaRepository.cs`:

```csharp
using api.Data;
using api.Interfaces;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Repositories
{
    public class FlanelinhaRepository : RepositoryBase<Flanelinha>, IFlanelinhaRepository
    {
        public FlanelinhaRepository(ApplicationDBContext context) : base(context)
        {
        }

        public async Task<Flanelinha?> GetByCpfAsync(string cpf, CancellationToken ct = default)
        {
            return await _dbSet.FirstOrDefaultAsync(f => f.Cpf == cpf, ct);
        }

        public async Task<List<Flanelinha>> GetAllByFiscalWithCarterinhasAsync(int idFiscal, CancellationToken ct = default)
        {
            return await _dbSet
                .Include(f => f.Carterinhas)
                .Where(f => f.IdFiscal == idFiscal)
                .ToListAsync(ct);
        }

        public async Task<Flanelinha?> GetByIdWithCarterinhasAsync(int id, CancellationToken ct = default)
        {
            return await _dbSet
                .Include(f => f.Carterinhas)
                .FirstOrDefaultAsync(f => f.IdFlanel == id, ct);
        }

        public async Task<Carterinha?> GetCarterinhaAtivaAsync(int idFlanel, CancellationToken ct = default)
        {
            return await _context.Carterinhas
                .Where(c => c.IdFlanel == idFlanel && c.Ativo)
                .OrderByDescending(c => c.DataEmissao)
                .FirstOrDefaultAsync(ct);
        }

        public async Task AddCarterinhaAsync(Carterinha carterinha, CancellationToken ct = default)
        {
            await _context.Carterinhas.AddAsync(carterinha, ct);
        }

        public async Task<int> GetProximoNumeroCarterinhaAsync(CancellationToken ct = default)
        {
            var existeAlguma = await _context.Carterinhas.AnyAsync(ct);
            if (!existeAlguma)
            {
                return 1;
            }

            var maiorNumero = await _context.Carterinhas.MaxAsync(c => c.NumeroCarterinha, ct);
            return maiorNumero + 1;
        }
    }
}
```

- [ ] **Step 3: Build**

Run: `dotnet build`
Expected: FAIL — `FlanelinhaController.cs` still calls `GetAllWithCarterinhasAsync`, which no longer exists. Expected at this point; resolved in Task 9.

- [ ] **Step 4: Commit**

```bash
git add api/Interfaces/IFlanelinhaRepository.cs api/Repositories/FlanelinhaRepository.cs
git commit -m "feat: scope Flanelinha listing to the owning Fiscal"
```

---

### Task 8: Stop trusting client-supplied `IdFiscal` on create

**Files:**
- Modify: `api/Dtos/Flanelinha/CreateFlanelinhaDto.cs`
- Modify: `api/Mappers/FlanelinhaMappers.cs`

- [ ] **Step 1: Remove `IdFiscal` from `CreateFlanelinhaDto`**

Replace the full contents of `api/Dtos/Flanelinha/CreateFlanelinhaDto.cs`:

```csharp
using System.ComponentModel.DataAnnotations;

namespace api.Dtos.Flanelinha
{
    public class CreateFlanelinhaDto
    {
        public string Nome { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Cpf { get; set; } = string.Empty;
        public string PontoAtuacao { get; set; } = string.Empty;
        public string Telefone { get; set; } = string.Empty;
        public bool Ativo { get; set; } = true;

        [Required]
        [MinLength(6)]
        public string Senha { get; set; } = "Senha123";
    }
}
```

- [ ] **Step 2: Stop mapping `IdFiscal` in `FlanelinhaMappers.ToCreateFlanelinhaDto`**

In `api/Mappers/FlanelinhaMappers.cs`, remove the `IdFiscal = flanelinhaDto.IdFiscal` line from `ToCreateFlanelinhaDto` (the controller sets `IdFiscal` from the authenticated token instead — see Task 9):

```csharp
public static Flanelinha ToCreateFlanelinhaDto(this CreateFlanelinhaDto flanelinhaDto)
{
    return new Flanelinha
    {
        Nome = flanelinhaDto.Nome,
        Email = flanelinhaDto.Email,
        Cpf = flanelinhaDto.Cpf,
        PontoAtuacao = flanelinhaDto.PontoAtuacao,
        Telefone = flanelinhaDto.Telefone,
        Ativo = flanelinhaDto.Ativo,
        Senha = flanelinhaDto.Senha,
        DataCadastro = DateTime.UtcNow
    };
}
```

- [ ] **Step 3: Build**

Run: `dotnet build`
Expected: Still FAIL — same pre-existing break from Task 7 (`FlanelinhaController.GetAll` calling a removed method). Expected at this point; resolved in Task 9.

- [ ] **Step 4: Commit**

```bash
git add api/Dtos/Flanelinha/CreateFlanelinhaDto.cs api/Mappers/FlanelinhaMappers.cs
git commit -m "fix: stop trusting client-supplied IdFiscal on Flanelinha creation"
```

---

### Task 9: Rewrite `FlanelinhaController`

**Files:**
- Modify: `api/Controllers/FlanelinhaController.cs`

- [ ] **Step 1: Replace the full file**

Replace the full contents of `api/Controllers/FlanelinhaController.cs`:

```csharp
using System.Security.Claims;
using api.Dtos.Flanelinha;
using api.Enums;
using api.Interfaces;
using api.Mappers;
using api.Models;
using api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers
{
    [Route("api/flanelinha")]
    [ApiController]
    public class FlanelinhaController : ControllerBase
    {
        private readonly IFlanelinhaRepository _flanelinhaRepository;

        public FlanelinhaController(IFlanelinhaRepository flanelinhaRepository)
        {
            _flanelinhaRepository = flanelinhaRepository;
        }

        private int AuthenticatedId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpGet]
        [Authorize(Roles = "Fiscal")]
        public async Task<IActionResult> GetAll(CancellationToken ct)
        {
            var flanelinhas = await _flanelinhaRepository.GetAllByFiscalWithCarterinhasAsync(AuthenticatedId, ct);
            return Ok(flanelinhas.Select(f => f.ToFlanelinhaDto()));
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Fiscal")]
        public async Task<IActionResult> GetById(int id, CancellationToken ct)
        {
            var flanelinha = await _flanelinhaRepository.GetByIdWithCarterinhasAsync(id, ct);

            if (flanelinha == null)
            {
                return NotFound();
            }

            if (flanelinha.IdFiscal != AuthenticatedId)
            {
                return Forbid();
            }

            return Ok(flanelinha.ToFlanelinhaDto());
        }

        [HttpPost]
        [Authorize(Roles = "Fiscal")]
        public async Task<IActionResult> Create([FromBody] CreateFlanelinhaDto flanelinhaDto, CancellationToken ct)
        {
            var flanelinha = flanelinhaDto.ToCreateFlanelinhaDto();
            flanelinha.Senha = PasswordHasher.Hash(flanelinha.Senha);
            flanelinha.IdFiscal = AuthenticatedId;

            await _flanelinhaRepository.AddAsync(flanelinha, ct);
            await _flanelinhaRepository.SaveChangesAsync(ct);

            return CreatedAtAction(nameof(GetById), new { id = flanelinha.IdFlanel }, flanelinha.ToFlanelinhaDto());
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Fiscal")]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            var flanelinha = await _flanelinhaRepository.GetByIdAsync(id, ct);

            if (flanelinha == null)
            {
                return NotFound();
            }

            if (flanelinha.IdFiscal != AuthenticatedId)
            {
                return Forbid();
            }

            _flanelinhaRepository.Delete(flanelinha);
            await _flanelinhaRepository.SaveChangesAsync(ct);

            return NoContent();
        }

        [HttpPut("{id}/perfil")]
        [Authorize(Roles = "Flanelinha")]
        public async Task<IActionResult> UpdatePerfil(int id, [FromBody] UpdatePerfilDto perfilDto, CancellationToken ct)
        {
            if (id != AuthenticatedId)
            {
                return Forbid();
            }

            var flanelinha = await _flanelinhaRepository.GetByIdAsync(id, ct);

            if (flanelinha == null)
            {
                return NotFound();
            }

            flanelinha.Nome = perfilDto.Nome;
            flanelinha.Email = perfilDto.Email;

            await _flanelinhaRepository.SaveChangesAsync(ct);

            return Ok(flanelinha.ToFlanelinhaDto());
        }

        [HttpPut("{id}/senha")]
        [Authorize(Roles = "Flanelinha")]
        public async Task<IActionResult> ChangePassword(int id, [FromBody] ChangePasswordDto senhaDto, CancellationToken ct)
        {
            if (id != AuthenticatedId)
            {
                return Forbid();
            }

            var flanelinha = await _flanelinhaRepository.GetByIdAsync(id, ct);

            if (flanelinha == null)
            {
                return NotFound();
            }

            if (!flanelinha.PrimeiroAcesso)
            {
                if (string.IsNullOrEmpty(senhaDto.SenhaAtual) || !PasswordHasher.Verify(senhaDto.SenhaAtual, flanelinha.Senha))
                {
                    return BadRequest("Senha atual inválida.");
                }
            }

            flanelinha.Senha = PasswordHasher.Hash(senhaDto.NovaSenha);
            flanelinha.PrimeiroAcesso = false;

            await _flanelinhaRepository.SaveChangesAsync(ct);

            return NoContent();
        }

        [HttpPost("{id}/carteiras")]
        [Authorize(Roles = "Flanelinha")]
        public async Task<IActionResult> RequestCarteira(int id, [FromBody] RequestCarteiraDto? dto, CancellationToken ct)
        {
            if (id != AuthenticatedId)
            {
                return Forbid();
            }

            var flanelinha = await _flanelinhaRepository.GetByIdWithCarterinhasAsync(id, ct);

            if (flanelinha == null)
            {
                return NotFound();
            }

            var carteiraAtiva = flanelinha.Carterinhas
                .Where(c => c.Ativo)
                .OrderByDescending(c => c.DataEmissao)
                .FirstOrDefault();

            if (carteiraAtiva != null && carteiraAtiva.DataValidade > DateTime.UtcNow)
            {
                return BadRequest("A carteira atual ainda é válida.");
            }

            if (carteiraAtiva != null)
            {
                carteiraAtiva.Ativo = false;
            }

            var proximoNumero = await _flanelinhaRepository.GetProximoNumeroCarterinhaAsync(ct);

            var novaCarteira = new Carterinha
            {
                IdFlanel = id,
                NumeroCarterinha = proximoNumero,
                DataEmissao = DateTime.UtcNow,
                DataValidade = DateTime.UtcNow.AddYears(1),
                Ativo = true,
                Tipo = flanelinha.Carterinhas.Count == 0 ? TipoCarterinha.PrimeiraVia : TipoCarterinha.SegundaVia
            };

            await _flanelinhaRepository.AddCarterinhaAsync(novaCarteira, ct);
            await _flanelinhaRepository.SaveChangesAsync(ct);

            return CreatedAtAction(nameof(GetById), new { id }, novaCarteira.ToCarterinhaDto());
        }
    }
}
```

- [ ] **Step 2: Build**

Run: `dotnet build`
Expected: `Build succeeded.` (This resolves the breaks introduced in Tasks 7 and 8.)

- [ ] **Step 3: Commit**

```bash
git add api/Controllers/FlanelinhaController.cs
git commit -m "feat: protect FlanelinhaController endpoints with JWT auth and ownership checks"
```

---

### Task 10: Rewrite `FiscalController`

**Files:**
- Modify: `api/Controllers/FiscalController.cs`

- [ ] **Step 1: Replace the full file**

Replace the full contents of `api/Controllers/FiscalController.cs`:

```csharp
using System.Security.Claims;
using api.Dtos.Fiscal;
using api.Interfaces;
using api.Mappers;
using api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers
{
    [Route("api/fiscal")]
    [ApiController]
    [Authorize(Roles = "Fiscal")]
    public class FiscalController : ControllerBase
    {
        private readonly IFiscalRepository _fiscalRepository;

        public FiscalController(IFiscalRepository fiscalRepository)
        {
            _fiscalRepository = fiscalRepository;
        }

        private int AuthenticatedId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpGet]
        public async Task<IActionResult> GetAll(CancellationToken ct)
        {
            var fiscals = await _fiscalRepository.GetAllAsync(ct);
            return Ok(fiscals.Select(f => f.ToFiscalDto()));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id, CancellationToken ct)
        {
            var fiscal = await _fiscalRepository.GetByIdAsync(id, ct);

            if (fiscal == null)
            {
                return NotFound();
            }

            return Ok(fiscal.ToFiscalDto());
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateFiscalDto fiscalDto, CancellationToken ct)
        {
            var fiscal = fiscalDto.ToCreateFiscalDto();
            fiscal.Senha = PasswordHasher.Hash(fiscal.Senha);

            await _fiscalRepository.AddAsync(fiscal, ct);
            await _fiscalRepository.SaveChangesAsync(ct);

            return CreatedAtAction(nameof(GetById), new { id = fiscal.IdFiscal }, fiscal.ToFiscalDto());
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            var fiscal = await _fiscalRepository.GetByIdAsync(id, ct);

            if (fiscal == null)
            {
                return NotFound();
            }

            _fiscalRepository.Delete(fiscal);
            await _fiscalRepository.SaveChangesAsync(ct);

            return NoContent();
        }

        [HttpPut("{id}/perfil")]
        public async Task<IActionResult> UpdatePerfil(int id, [FromBody] UpdatePerfilDto perfilDto, CancellationToken ct)
        {
            if (id != AuthenticatedId)
            {
                return Forbid();
            }

            var fiscal = await _fiscalRepository.GetByIdAsync(id, ct);

            if (fiscal == null)
            {
                return NotFound();
            }

            fiscal.Nome = perfilDto.Nome;
            fiscal.Email = perfilDto.Email;

            await _fiscalRepository.SaveChangesAsync(ct);

            return Ok(fiscal.ToFiscalDto());
        }

        [HttpPut("{id}/senha")]
        public async Task<IActionResult> ChangePassword(int id, [FromBody] ChangePasswordDto senhaDto, CancellationToken ct)
        {
            if (id != AuthenticatedId)
            {
                return Forbid();
            }

            var fiscal = await _fiscalRepository.GetByIdAsync(id, ct);

            if (fiscal == null)
            {
                return NotFound();
            }

            if (string.IsNullOrEmpty(senhaDto.SenhaAtual) || !PasswordHasher.Verify(senhaDto.SenhaAtual, fiscal.Senha))
            {
                return BadRequest("Senha atual inválida.");
            }

            fiscal.Senha = PasswordHasher.Hash(senhaDto.NovaSenha);

            await _fiscalRepository.SaveChangesAsync(ct);

            return NoContent();
        }
    }
}
```

- [ ] **Step 2: Build**

Run: `dotnet build`
Expected: `Build succeeded.`

- [ ] **Step 3: Commit**

```bash
git add api/Controllers/FiscalController.cs
git commit -m "feat: protect FiscalController endpoints with JWT auth and ownership checks"
```

---

### Task 11: Apply migration and smoke-test manually

**Files:** none (verification only)

- [ ] **Step 1: Confirm local Postgres is reachable**

The connection string in `api/appsettings.json` points to `Host=localhost;Port=5432;Database=postgres-api-flanelinha-app`. Confirm this local dev database is running before continuing.

- [ ] **Step 2: Apply the migration**

Run from `api/`:
```
dotnet ef database update
```
Expected: output ends with `Done.`. If it fails on the unique index due to pre-existing duplicate `Cpf` values, resolve per the note in Task 4 Step 2, then re-run.

- [ ] **Step 3: Run the API**

Run from `api/`:
```
dotnet run
```
Expected: console shows `Now listening on: https://localhost:<port>`. Leave running for the next steps. All `curl` commands below use `-k` (skip TLS verification) since this is a local dev cert; adjust `<port>` to the one shown.

- [ ] **Step 4: Smoke test — login as Fiscal**

Using an existing Fiscal's CPF/senha (create one first via `POST /api/fiscal` if none exist — this endpoint is now protected, so for this one bootstrap call you'll need a token; if no Fiscal exists yet at all, temporarily comment out `[Authorize(Roles = "Fiscal")]` on `FiscalController`, create the first Fiscal, then restore the attribute and rebuild — this bootstrap problem is expected for a brand-new system and out of scope to solve generally in this plan):

```
curl -X POST https://localhost:<port>/api/auth/login -H "Content-Type: application/json" -d "{\"cpf\":\"<cpf-do-fiscal>\",\"senha\":\"<senha>\"}" -k
```
Expected: `200 OK`, body has `tipoPerfil: "Fiscal"`, `primeiroAcesso: false`, a non-empty `token`, and `perfil` with the Fiscal's data (no `senha` field). Copy the `token` value for the next steps.

- [ ] **Step 5: Smoke test — login as Flanelinha**

Using an existing Flanelinha's CPF/senha (create one via `POST /api/flanelinha` using the Fiscal's token from Step 4):
```
curl -X POST https://localhost:<port>/api/auth/login -H "Content-Type: application/json" -d "{\"cpf\":\"<cpf-do-flanelinha>\",\"senha\":\"<senha>\"}" -k
```
Expected: `200 OK`, `tipoPerfil: "Flanelinha"`, `primeiroAcesso: true` (for a freshly created Flanelinha).

- [ ] **Step 6: Smoke test — invalid login**

```
curl -X POST https://localhost:<port>/api/auth/login -H "Content-Type: application/json" -d "{\"cpf\":\"00000000000\",\"senha\":\"errada\"}" -k
```
Expected: `401 Unauthorized`.

- [ ] **Step 7: Smoke test — protected endpoint without token**

```
curl -X GET https://localhost:<port>/api/flanelinha -k
```
Expected: `401 Unauthorized`.

- [ ] **Step 8: Smoke test — Fiscal-scoped listing**

```
curl -X GET https://localhost:<port>/api/flanelinha -H "Authorization: Bearer <token-do-fiscal>" -k
```
Expected: `200 OK`, only Flanelinhas whose `idFiscal` matches this Fiscal.

- [ ] **Step 9: Smoke test — wrong role**

```
curl -X GET https://localhost:<port>/api/flanelinha -H "Authorization: Bearer <token-do-flanelinha>" -k
```
Expected: `403 Forbidden`.

```
curl -X PUT https://localhost:<port>/api/fiscal/1/perfil -H "Authorization: Bearer <token-do-flanelinha>" -H "Content-Type: application/json" -d "{\"nome\":\"x\",\"email\":\"x@x.com\"}" -k
```
Expected: `403 Forbidden`.

- [ ] **Step 10: Smoke test — ownership mismatch**

Using the Flanelinha token from Step 5 against a *different* Flanelinha's id (or `999` if only one exists):
```
curl -X PUT https://localhost:<port>/api/flanelinha/999/senha -H "Authorization: Bearer <token-do-flanelinha>" -H "Content-Type: application/json" -d "{\"novaSenha\":\"NovaSenha456\"}" -k
```
Expected: `403 Forbidden`.

- [ ] **Step 11: Smoke test — first-access password change succeeds with correct id**

```
curl -X PUT https://localhost:<port>/api/flanelinha/<id-do-flanelinha>/senha -H "Authorization: Bearer <token-do-flanelinha>" -H "Content-Type: application/json" -d "{\"novaSenha\":\"NovaSenha456\"}" -k
```
Expected: `204 No Content`.

- [ ] **Step 12: Stop the server**

Ctrl+C in the terminal running `dotnet run`.

- [ ] **Step 13: Final commit (if anything changed beyond Task 10's commit)**

```bash
git status
```
Expected: clean relative to Task 10's commit (`dotnet ef database update` only touches the Postgres database, not files). If clean, no further commit is needed.
