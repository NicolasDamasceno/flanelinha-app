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
        private const string InvalidCredentialsMessage = "CPF ou senha inválidos.";

        // Hash bcrypt válido (qualquer um serve — nunca confere com senha real) usado para
        // manter o custo de verificação constante quando o CPF não é encontrado, evitando
        // que o tempo de resposta revele se o CPF existe (side-channel de enumeração).
        private const string DummyHash = "$2a$11$Rmrh3q5qwmfzkPXKUVsKC.qtEsm2YG85ujxey6cJpJUzThqD6xlo.";

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
                    return Unauthorized(InvalidCredentialsMessage);
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
                    return Unauthorized(InvalidCredentialsMessage);
                }

                var token = _tokenGenerator.GenerateToken(flanelinha.IdFlanel, "Flanelinha", flanelinha.Nome);
                var flanelinhaDto = flanelinha.ToFlanelinhaDto();
                flanelinhaDto.FotoBase64 = null;
                return Ok(new LoginResponseDto
                {
                    Token = token,
                    TipoPerfil = "Flanelinha",
                    PrimeiroAcesso = flanelinha.PrimeiroAcesso,
                    Perfil = flanelinhaDto
                });
            }

            // Paga o custo do BCrypt mesmo quando o CPF não existe em nenhuma tabela, para que
            // o tempo de resposta não sirva de sinal para enumerar CPFs válidos.
            PasswordHasher.Verify(dto.Senha, DummyHash);
            return Unauthorized(InvalidCredentialsMessage);
        }
    }
}
