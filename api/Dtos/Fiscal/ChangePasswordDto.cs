namespace api.Dtos.Fiscal
{
    public class ChangePasswordDto
    {
        public string SenhaAtual { get; set; } = string.Empty;
        public string NovaSenha { get; set; } = string.Empty;
    }
}
