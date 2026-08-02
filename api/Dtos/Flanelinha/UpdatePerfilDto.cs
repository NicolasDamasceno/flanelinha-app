using System.ComponentModel.DataAnnotations;

namespace api.Dtos.Flanelinha
{
    public class UpdatePerfilDto
    {
        [Required]
        public string Nome { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
    }
}
