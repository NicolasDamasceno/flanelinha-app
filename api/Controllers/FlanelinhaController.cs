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

        [HttpGet("me")]
        [Authorize(Roles = "Flanelinha")]
        public async Task<IActionResult> GetMe(CancellationToken ct)
        {
            var flanelinha = await _flanelinhaRepository.GetByIdWithCarterinhasAsync(AuthenticatedId, ct);

            if (flanelinha == null)
            {
                return NotFound();
            }

            return Ok(flanelinha.ToFlanelinhaDto());
        }

        [HttpPost]
        [Authorize(Roles = "Fiscal")]
        public async Task<IActionResult> Create([FromBody] CreateFlanelinhaDto flanelinhaDto, CancellationToken ct)
        {
            if (await _flanelinhaRepository.GetByCpfAsync(flanelinhaDto.Cpf, ct) != null)
            {
                return BadRequest("Já existe um Flanelinha cadastrado com esse CPF.");
            }

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

        [HttpPut("{id}")]
        [Authorize(Roles = "Fiscal")]
        public async Task<IActionResult> UpdateByFiscal(int id, [FromBody] UpdateFlanelinhaDto dto, CancellationToken ct)
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

            flanelinha.Nome = dto.Nome;
            flanelinha.Email = dto.Email;
            flanelinha.PontoAtuacao = dto.PontoAtuacao;
            flanelinha.Telefone = dto.Telefone;
            flanelinha.Ativo = dto.Ativo!.Value;

            await _flanelinhaRepository.SaveChangesAsync(ct);

            return Ok(flanelinha.ToFlanelinhaDto());
        }

        [HttpPut("{id}/perfil")]
        [Authorize(Roles = "Flanelinha")]
        public async Task<IActionResult> UpdatePerfil(int id, [FromBody] UpdatePerfilDto perfilDto, CancellationToken ct)
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
