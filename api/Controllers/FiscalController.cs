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
