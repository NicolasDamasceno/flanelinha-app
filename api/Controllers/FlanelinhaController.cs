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
        public async Task<IActionResult> RequestCarteira(int id, [FromBody] RequestCarteiraDto? dto, CancellationToken ct)
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
