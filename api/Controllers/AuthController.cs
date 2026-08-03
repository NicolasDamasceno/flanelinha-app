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
