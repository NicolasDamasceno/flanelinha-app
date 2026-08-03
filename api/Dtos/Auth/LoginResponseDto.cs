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
