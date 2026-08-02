using System.ComponentModel.DataAnnotations;

namespace api.Dtos.Flanelinha
{
    public class ChangePasswordDto
    {
        public string? SenhaAtual { get; set; }

        [Required]
        [MinLength(6)]
        public string NovaSenha { get; set; } = string.Empty;
    }
}
