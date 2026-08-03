using System.ComponentModel.DataAnnotations;

namespace api.Dtos.Auth
{
    public class LoginDto
    {
        [Required]
        public string Cpf { get; set; } = string.Empty;

        [Required]
        public string Senha { get; set; } = string.Empty;
    }
}
