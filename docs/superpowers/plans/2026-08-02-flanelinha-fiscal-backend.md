# Flanelinha/Fiscal Backend (Repository + Perfil/Senha/Carteira) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce an async Repository pattern for `Flanelinha`/`Fiscal` and add profile-update, password-change, and carteira-renewal endpoints, per the approved spec at `docs/superpowers/specs/2026-08-02-flanelinha-fiscal-backend-design.md`.

**Architecture:** Generic `IRepository<T>` + EF Core `RepositoryBase<T>` shared by two entity-specific repositories (`IFlanelinhaRepository`, `IFiscalRepository`) that also carry domain-specific queries (active carteira lookup, next carteira number). Controllers are refactored to inject the repositories instead of `ApplicationDBContext` directly, become fully `async`/`CancellationToken`-aware, and map to DTOs instead of returning raw entities. Passwords move to BCrypt hashing via a small `PasswordHasher` helper that swallows `SaltParseException` (legacy plaintext rows) as "invalid password" rather than crashing.

**Tech Stack:** ASP.NET Core 9 Web API, EF Core 9 (Npgsql), `BCrypt.Net-Next`.

**Testing approach:** This repo has no test project or solution file today (confirmed with the user — decision: build + manual verification only, no new test project introduced by this plan). Every task's verification step is `dotnet build` plus, where relevant, a manual HTTP call via the Scalar UI (`https://localhost:<port>/scalar`) or `curl`, run from the `api/` directory unless noted.

---

## Chunk 1: Full implementation

### Task 1: Add `Email` to the `Flanelinha` model + migration

**Files:**
- Modify: `api/Models/Flanelinha.cs`

- [ ] **Step 1: Add the `Email` property**

In `api/Models/Flanelinha.cs`, add the field alongside the other simple string properties (after `Nome`):

```csharp
public string Nome {get; set;} = string.Empty;
public string Email {get; set;} = string.Empty;
public string Cpf {get; set;} = string.Empty;
```

- [ ] **Step 2: Generate the migration**

Run from `api/`:
```
dotnet ef migrations add FlanelinhaEmail
```
Expected: new files `Migrations/<timestamp>_FlanelinhaEmail.cs` and `.Designer.cs`, and `ApplicationDBContextModelSnapshot.cs` updated with the new `Email` property under `api.Models.Flanelinha`.

- [ ] **Step 3: Build**

Run: `dotnet build`
Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add api/Models/Flanelinha.cs api/Migrations/
git commit -m "feat: add Email field to Flanelinha model"
```

---

### Task 2: Password hashing helper

**Files:**
- Create: `api/Security/PasswordHasher.cs`
- Modify: `api/api.csproj`

- [ ] **Step 1: Add the BCrypt package**

Run from `api/`:
```
dotnet add package BCrypt.Net-Next
```
Expected: `api.csproj` gains a `<PackageReference Include="BCrypt.Net-Next" ... />` line.

- [ ] **Step 2: Create the helper**

Create `api/Security/PasswordHasher.cs`:

```csharp
namespace api.Security
{
    public static class PasswordHasher
    {
        public static string Hash(string senha)
        {
            return BCrypt.Net.BCrypt.HashPassword(senha);
        }

        public static bool Verify(string senha, string hash)
        {
            try
            {
                return BCrypt.Net.BCrypt.Verify(senha, hash);
            }
            catch (BCrypt.Net.SaltParseException)
            {
                // Registro legado gravado em texto puro antes da adoção de hash — trata como senha inválida.
                return false;
            }
        }
    }
}
```

- [ ] **Step 3: Build**

Run: `dotnet build`
Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add api/Security/PasswordHasher.cs api/api.csproj
git commit -m "feat: add BCrypt-based password hashing helper"
```

---

### Task 3: Repository interfaces

**Files:**
- Create: `api/Interfaces/IRepository.cs`
- Create: `api/Interfaces/IFlanelinhaRepository.cs`
- Create: `api/Interfaces/IFiscalRepository.cs`

- [ ] **Step 1: Generic repository interface**

Create `api/Interfaces/IRepository.cs`:

```csharp
namespace api.Interfaces
{
    public interface IRepository<T> where T : class
    {
        Task<List<T>> GetAllAsync(CancellationToken ct = default);
        Task<T?> GetByIdAsync(int id, CancellationToken ct = default);
        Task AddAsync(T entity, CancellationToken ct = default);
        void Update(T entity);
        void Delete(T entity);
        Task<bool> SaveChangesAsync(CancellationToken ct = default);
    }
}
```

- [ ] **Step 2: Flanelinha-specific interface**

Create `api/Interfaces/IFlanelinhaRepository.cs`:

```csharp
using api.Models;

namespace api.Interfaces
{
    public interface IFlanelinhaRepository : IRepository<Flanelinha>
    {
        Task<List<Flanelinha>> GetAllWithCarterinhasAsync(CancellationToken ct = default);
        Task<Flanelinha?> GetByIdWithCarterinhasAsync(int id, CancellationToken ct = default);
        Task<Carterinha?> GetCarterinhaAtivaAsync(int idFlanel, CancellationToken ct = default);
        Task AddCarterinhaAsync(Carterinha carterinha, CancellationToken ct = default);
        Task<int> GetProximoNumeroCarterinhaAsync(CancellationToken ct = default);
    }
}
```

- [ ] **Step 3: Fiscal-specific interface**

Create `api/Interfaces/IFiscalRepository.cs`:

```csharp
using api.Models;

namespace api.Interfaces
{
    public interface IFiscalRepository : IRepository<Fiscal>
    {
    }
}
```

- [ ] **Step 4: Build**

Run: `dotnet build`
Expected: `Build succeeded.` (New interfaces with no implementers and no consumers yet are valid, buildable C# — nothing references them until Task 4.)

- [ ] **Step 5: Commit**

```bash
git add api/Interfaces/
git commit -m "feat: add repository interfaces for Flanelinha and Fiscal"
```

---

### Task 4: Repository implementations

**Files:**
- Create: `api/Repositories/RepositoryBase.cs`
- Create: `api/Repositories/FlanelinhaRepository.cs`
- Create: `api/Repositories/FiscalRepository.cs`

- [ ] **Step 1: Generic EF Core base**

Create `api/Repositories/RepositoryBase.cs`:

```csharp
using api.Data;
using api.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace api.Repositories
{
    public abstract class RepositoryBase<T> : IRepository<T> where T : class
    {
        protected readonly ApplicationDBContext _context;
        protected readonly DbSet<T> _dbSet;

        protected RepositoryBase(ApplicationDBContext context)
        {
            _context = context;
            _dbSet = context.Set<T>();
        }

        public virtual async Task<List<T>> GetAllAsync(CancellationToken ct = default)
        {
            return await _dbSet.ToListAsync(ct);
        }

        public virtual async Task<T?> GetByIdAsync(int id, CancellationToken ct = default)
        {
            return await _dbSet.FindAsync(new object[] { id }, ct);
        }

        public virtual async Task AddAsync(T entity, CancellationToken ct = default)
        {
            await _dbSet.AddAsync(entity, ct);
        }

        public virtual void Update(T entity)
        {
            _dbSet.Update(entity);
        }

        public virtual void Delete(T entity)
        {
            _dbSet.Remove(entity);
        }

        public async Task<bool> SaveChangesAsync(CancellationToken ct = default)
        {
            return await _context.SaveChangesAsync(ct) > 0;
        }
    }
}
```

- [ ] **Step 2: Flanelinha repository**

Create `api/Repositories/FlanelinhaRepository.cs`:

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

- [ ] **Step 3: Fiscal repository**

Create `api/Repositories/FiscalRepository.cs`:

```csharp
using api.Data;
using api.Interfaces;
using api.Models;

namespace api.Repositories
{
    public class FiscalRepository : RepositoryBase<Fiscal>, IFiscalRepository
    {
        public FiscalRepository(ApplicationDBContext context) : base(context)
        {
        }
    }
}
```

- [ ] **Step 4: Build**

Run: `dotnet build`
Expected: `Build succeeded.`

- [ ] **Step 5: Commit**

```bash
git add api/Repositories/
git commit -m "feat: implement EF Core repositories for Flanelinha and Fiscal"
```

---

### Task 5: DTOs — new, updated, and removed

**Files:**
- Modify: `api/Dtos/Flanelinha/CreateFlanelinhaDto.cs`
- Modify: `api/Dtos/Flanelinha/FlanelinhaDto.cs`
- Create: `api/Dtos/Flanelinha/UpdatePerfilDto.cs`
- Create: `api/Dtos/Flanelinha/ChangePasswordDto.cs`
- Create: `api/Dtos/Flanelinha/RequestCarteiraDto.cs`
- Create: `api/Dtos/Flanelinha/CarterinhaDto.cs`
- Create: `api/Dtos/Fiscal/UpdatePerfilDto.cs`
- Create: `api/Dtos/Fiscal/ChangePasswordDto.cs`
- Delete: `api/Dtos/Fiscal/UpdateFiscalDto.cs`

- [ ] **Step 1: Add `Email` to `CreateFlanelinhaDto`**

In `api/Dtos/Flanelinha/CreateFlanelinhaDto.cs`, add after `Nome`:

```csharp
public string Nome { get; set; } = string.Empty;
public string Email { get; set; } = string.Empty;
public string Cpf { get; set; } = string.Empty;
```

- [ ] **Step 2: Fix `FlanelinhaDto`**

Replace the full contents of `api/Dtos/Flanelinha/FlanelinhaDto.cs`:

```csharp
using System;
using System.Collections.Generic;

namespace api.Dtos.Flanelinha
{
    public class FlanelinhaDto
    {
        public int IdFlanel { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Cpf { get; set; } = string.Empty;
        public string PontoAtuacao { get; set; } = string.Empty;
        public string Telefone { get; set; } = string.Empty;
        public bool Ativo { get; set; } = false;
        public DateTime DataCadastro { get; set; } = DateTime.UtcNow;
        public int? IdFiscal { get; set; }
        public List<CarterinhaDto> Carterinhas { get; set; } = new List<CarterinhaDto>();
    }
}
```

(`Telefone` changes from `int` to `string` to match `Models/Flanelinha.cs`; `Carterinhas` changes from `List<Carterinha>` to `List<CarterinhaDto>`.)

- [ ] **Step 3: New `CarterinhaDto`**

Create `api/Dtos/Flanelinha/CarterinhaDto.cs`:

```csharp
using api.Enums;

namespace api.Dtos.Flanelinha
{
    public class CarterinhaDto
    {
        public int IdCarterinha { get; set; }
        public int NumeroCarterinha { get; set; }
        public DateTime DataEmissao { get; set; }
        public DateTime DataValidade { get; set; }
        public bool Ativo { get; set; }
        public TipoCarterinha Tipo { get; set; }
    }
}
```

- [ ] **Step 4: New `UpdatePerfilDto` (Flanelinha)**

Create `api/Dtos/Flanelinha/UpdatePerfilDto.cs`:

```csharp
namespace api.Dtos.Flanelinha
{
    public class UpdatePerfilDto
    {
        public string Nome { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }
}
```

- [ ] **Step 5: New `ChangePasswordDto` (Flanelinha)**

Create `api/Dtos/Flanelinha/ChangePasswordDto.cs`:

```csharp
namespace api.Dtos.Flanelinha
{
    public class ChangePasswordDto
    {
        public string? SenhaAtual { get; set; }
        public string NovaSenha { get; set; } = string.Empty;
    }
}
```

- [ ] **Step 6: New `RequestCarteiraDto`**

Create `api/Dtos/Flanelinha/RequestCarteiraDto.cs`:

```csharp
namespace api.Dtos.Flanelinha
{
    public class RequestCarteiraDto
    {
    }
}
```

- [ ] **Step 7: New `UpdatePerfilDto` (Fiscal)**

Create `api/Dtos/Fiscal/UpdatePerfilDto.cs`:

```csharp
namespace api.Dtos.Fiscal
{
    public class UpdatePerfilDto
    {
        public string Nome { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }
}
```

- [ ] **Step 8: New `ChangePasswordDto` (Fiscal)**

Create `api/Dtos/Fiscal/ChangePasswordDto.cs`:

```csharp
namespace api.Dtos.Fiscal
{
    public class ChangePasswordDto
    {
        public string SenhaAtual { get; set; } = string.Empty;
        public string NovaSenha { get; set; } = string.Empty;
    }
}
```

(No `?` on `SenhaAtual` here — Fiscal has no first-access flow, so it's always required.)

- [ ] **Step 9: Delete the now-orphaned `UpdateFiscalDto`**

```bash
rm api/Dtos/Fiscal/UpdateFiscalDto.cs
```
(PowerShell: `Remove-Item api/Dtos/Fiscal/UpdateFiscalDto.cs`)

- [ ] **Step 10: Build**

Run: `dotnet build`
Expected: FAIL — `FiscalController.cs` still has `[HttpPut("{id}")] Update` referencing the `UpdateFiscalDto` just deleted in this task. This is expected; resolved in Task 9.

- [ ] **Step 11: Commit**

```bash
git add api/Dtos/
git commit -m "feat: add profile/password/carteira DTOs, fix FlanelinhaDto shape"
```

---

### Task 6: Mappers

**Files:**
- Modify: `api/Mappers/FlanelinhaMappers.cs`

`FiscalMappers.cs` needs no changes — `ToFiscalDto`/`ToCreateFiscalDto` already map every field correctly (verified against the current `FiscalDto`/`CreateFiscalDto`/`Fiscal` shapes).

- [ ] **Step 1: Rewrite `FlanelinhaMappers`**

Replace the full contents of `api/Mappers/FlanelinhaMappers.cs`:

```csharp
using api.Dtos.Flanelinha;
using api.Models;

namespace api.Mappers
{
    public static class FlanelinhaMappers
    {
        public static FlanelinhaDto ToFlanelinhaDto(this Flanelinha flanelinhaModel)
        {
            return new FlanelinhaDto
            {
                IdFlanel = flanelinhaModel.IdFlanel,
                Nome = flanelinhaModel.Nome,
                Email = flanelinhaModel.Email,
                Cpf = flanelinhaModel.Cpf,
                PontoAtuacao = flanelinhaModel.PontoAtuacao,
                Telefone = flanelinhaModel.Telefone,
                Ativo = flanelinhaModel.Ativo,
                DataCadastro = flanelinhaModel.DataCadastro,
                IdFiscal = flanelinhaModel.IdFiscal,
                Carterinhas = flanelinhaModel.Carterinhas.Select(c => c.ToCarterinhaDto()).ToList()
            };
        }

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
                DataCadastro = DateTime.UtcNow,
                IdFiscal = flanelinhaDto.IdFiscal
            };
        }

        public static CarterinhaDto ToCarterinhaDto(this Carterinha carterinhaModel)
        {
            return new CarterinhaDto
            {
                IdCarterinha = carterinhaModel.IdCarterinha,
                NumeroCarterinha = carterinhaModel.NumeroCarterinha,
                DataEmissao = carterinhaModel.DataEmissao,
                DataValidade = carterinhaModel.DataValidade,
                Ativo = carterinhaModel.Ativo,
                Tipo = carterinhaModel.Tipo
            };
        }
    }
}
```

Note: `ToCreateFlanelinhaDto` still assigns the DTO's raw `Senha` — Task 8 hashes it in the controller right after calling this mapper, same pattern as the current code's `Create` action.

- [ ] **Step 2: Build**

Run: `dotnet build`
Expected: Still FAIL — `FiscalController.cs` still has `[HttpPut("{id}")] Update` referencing the `UpdateFiscalDto` deleted in Task 5. Expected at this point; resolved in Task 9.

- [ ] **Step 3: Commit**

```bash
git add api/Mappers/FlanelinhaMappers.cs
git commit -m "fix: FlanelinhaMappers.ToFlanelinhaDto now returns FlanelinhaDto instead of Flanelinha"
```

---

### Task 7: Wire repositories into DI

**Files:**
- Modify: `api/Program.cs`

- [ ] **Step 1: Register the repositories**

In `api/Program.cs`, add after the `AddDbContext` block:

```csharp
builder.Services.AddDbContext<ApplicationDBContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
});

builder.Services.AddScoped<IFlanelinhaRepository, FlanelinhaRepository>();
builder.Services.AddScoped<IFiscalRepository, FiscalRepository>();
```

And add the two `using` statements at the top of the file:

```csharp
using api.Data;
using api.Interfaces;
using api.Repositories;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
```

- [ ] **Step 2: Build**

Run: `dotnet build`
Expected: Still FAIL — `FiscalController.cs` still has `[HttpPut("{id}")] Update` referencing the `UpdateFiscalDto` deleted in Task 5. Expected at this point; resolved in Task 9.

- [ ] **Step 3: Commit**

```bash
git add api/Program.cs
git commit -m "feat: register Flanelinha/Fiscal repositories in DI container"
```

---

### Task 8: Rewrite `FlanelinhaController`

**Files:**
- Modify: `api/Controllers/FlanelinhaController.cs`

- [ ] **Step 1: Replace the full file**

Replace the full contents of `api/Controllers/FlanelinhaController.cs`:

```csharp
using api.Dtos.Flanelinha;
using api.Enums;
using api.Interfaces;
using api.Mappers;
using api.Models;
using api.Security;
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

        [HttpGet]
        public async Task<IActionResult> GetAll(CancellationToken ct)
        {
            var flanelinhas = await _flanelinhaRepository.GetAllWithCarterinhasAsync(ct);
            return Ok(flanelinhas.Select(f => f.ToFlanelinhaDto()));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id, CancellationToken ct)
        {
            var flanelinha = await _flanelinhaRepository.GetByIdWithCarterinhasAsync(id, ct);

            if (flanelinha == null)
            {
                return NotFound();
            }

            return Ok(flanelinha.ToFlanelinhaDto());
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateFlanelinhaDto flanelinhaDto, CancellationToken ct)
        {
            var flanelinha = flanelinhaDto.ToCreateFlanelinhaDto();
            flanelinha.Senha = PasswordHasher.Hash(flanelinha.Senha);

            await _flanelinhaRepository.AddAsync(flanelinha, ct);
            await _flanelinhaRepository.SaveChangesAsync(ct);

            return CreatedAtAction(nameof(GetById), new { id = flanelinha.IdFlanel }, flanelinha.ToFlanelinhaDto());
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            var flanelinha = await _flanelinhaRepository.GetByIdAsync(id, ct);

            if (flanelinha == null)
            {
                return NotFound();
            }

            _flanelinhaRepository.Delete(flanelinha);
            await _flanelinhaRepository.SaveChangesAsync(ct);

            return NoContent();
        }

        [HttpPut("{id}/perfil")]
        public async Task<IActionResult> UpdatePerfil(int id, [FromBody] UpdatePerfilDto perfilDto, CancellationToken ct)
        {
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
        public async Task<IActionResult> ChangePassword(int id, [FromBody] ChangePasswordDto senhaDto, CancellationToken ct)
        {
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
        public async Task<IActionResult> RequestCarteira(int id, [FromBody] RequestCarteiraDto _, CancellationToken ct)
        {
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
Expected: Still FAIL — `FiscalController` (Task 9) still references the deleted `UpdateFiscalDto`. Expected at this point.

- [ ] **Step 3: Commit**

```bash
git add api/Controllers/FlanelinhaController.cs
git commit -m "feat: refactor FlanelinhaController to async repository pattern, add perfil/senha/carteira endpoints"
```

---

### Task 9: Rewrite `FiscalController`

**Files:**
- Modify: `api/Controllers/FiscalController.cs`

- [ ] **Step 1: Replace the full file**

Replace the full contents of `api/Controllers/FiscalController.cs`:

```csharp
using api.Dtos.Fiscal;
using api.Interfaces;
using api.Mappers;
using api.Security;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers
{
    [Route("api/fiscal")]
    [ApiController]
    public class FiscalController : ControllerBase
    {
        private readonly IFiscalRepository _fiscalRepository;

        public FiscalController(IFiscalRepository fiscalRepository)
        {
            _fiscalRepository = fiscalRepository;
        }

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

Note this drops the old `[HttpPut("{id}")]` full-entity `Update` action entirely (replaced by `perfil` + `senha`), per the spec.

- [ ] **Step 2: Build**

Run: `dotnet build`
Expected: `Build succeeded.` All prior "expected FAIL" steps should now be resolved.

- [ ] **Step 3: Commit**

```bash
git add api/Controllers/FiscalController.cs
git commit -m "feat: refactor FiscalController to async repository pattern, add perfil/senha endpoints"
```

---

### Task 10: Apply migration and smoke-test manually

**Files:** none (verification only)

- [ ] **Step 1: Confirm local Postgres is reachable**

The connection string in `api/appsettings.json` points to `Host=localhost;Port=5432;Database=postgres-api-flanelinha-app`. Confirm this local dev database is running before continuing (e.g. `pg_isready -h localhost -p 5432`, or just attempt Step 2 and see if it fails to connect).

- [ ] **Step 2: Apply the migration**

Run from `api/`:
```
dotnet ef database update
```
Expected: output ends with `Done.` and the `Flanelinhas` table in `postgres-api-flanelinha-app` now has an `Email` column.

- [ ] **Step 3: Run the API**

Run from `api/`:
```
dotnet run
```
Expected: console shows `Now listening on: https://localhost:<port>`. Leave running for the next steps.

- [ ] **Step 4: Manual smoke test — Flanelinha profile update**

Open `https://localhost:<port>/scalar` in a browser, or run (adjust port and an existing `id`):
```
curl -X PUT https://localhost:<port>/api/flanelinha/1/perfil -H "Content-Type: application/json" -d "{\"nome\":\"Novo Nome\",\"email\":\"novo@email.com\"}" -k
```
Expected: `200 OK` with a `FlanelinhaDto` body showing the updated `nome`/`email`. `404` if no Flanelinha with id `1` exists yet — create one first via `POST /api/flanelinha`.

- [ ] **Step 5: Manual smoke test — first-access password change**

For a freshly created Flanelinha (`PrimeiroAcesso == true`), call without `senhaAtual`:
```
curl -X PUT https://localhost:<port>/api/flanelinha/1/senha -H "Content-Type: application/json" -d "{\"novaSenha\":\"NovaSenha456\"}" -k
```
Expected: `204 No Content`. Calling `GET /api/flanelinha/1` afterwards won't show `PrimeiroAcesso` (it's not on the DTO) — verify indirectly by re-running this same call again: it should now be treated as NOT first access, so it must fail without `senhaAtual`:
```
curl -X PUT https://localhost:<port>/api/flanelinha/1/senha -H "Content-Type: application/json" -d "{\"novaSenha\":\"OutraSenha789\"}" -k
```
Expected: `400 BadRequest` (no `senhaAtual` provided, and `PrimeiroAcesso` is now `false`).

- [ ] **Step 6: Manual smoke test — conventional password change**

```
curl -X PUT https://localhost:<port>/api/flanelinha/1/senha -H "Content-Type: application/json" -d "{\"senhaAtual\":\"NovaSenha456\",\"novaSenha\":\"OutraSenha789\"}" -k
```
Expected: `204 No Content`.

- [ ] **Step 7: Manual smoke test — nova carteira**

```
curl -X POST https://localhost:<port>/api/flanelinha/1/carteiras -H "Content-Type: application/json" -d "{}" -k
```
Expected: `201 Created` with a `CarterinhaDto` body, `tipo: 1` (PrimeiraVia) on the first call for a given Flanelinha. Calling it again immediately after:
```
curl -X POST https://localhost:<port>/api/flanelinha/1/carteiras -H "Content-Type: application/json" -d "{}" -k
```
Expected: `400 BadRequest` ("A carteira atual ainda é válida.") since the one just issued has `DataValidade` a year out.

- [ ] **Step 8: Manual smoke test — Fiscal endpoints**

Repeat Steps 4 and 6 against `/api/fiscal/{id}/perfil` and `/api/fiscal/{id}/senha` (note: Fiscal's `senha` endpoint always requires `senhaAtual`, even on the first call after `Create` — confirm `400` if you omit it).

- [ ] **Step 9: Stop the server**

Ctrl+C in the terminal running `dotnet run`.

- [ ] **Step 10: Final commit (if migration/appsettings changed)**

Only if `dotnet ef database update` or manual testing led to file changes beyond what's already committed (it normally won't — `database update` only touches the actual Postgres database, not files):
```bash
git status
```
If clean relative to Task 9's commit, no further commit is needed.
