using System.ComponentModel.DataAnnotations;

namespace api.Dtos.Flanelinha
{
    public class ChangePasswordDto
    {
        public string? SenhaAtual { get; set; }

        [Required]
        public string NovaSenha { get; set; } = string.Empty;
    }
}
