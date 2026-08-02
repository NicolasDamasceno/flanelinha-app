using System.ComponentModel.DataAnnotations;

namespace api.Dtos.Fiscal
{
    public class ChangePasswordDto
    {
        [Required]
        public string SenhaAtual { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string NovaSenha { get; set; } = string.Empty;
    }
}
