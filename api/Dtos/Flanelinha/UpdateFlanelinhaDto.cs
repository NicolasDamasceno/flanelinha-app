using System.ComponentModel.DataAnnotations;

namespace api.Dtos.Flanelinha
{
    public class UpdateFlanelinhaDto
    {
        [Required]
        public string Nome { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PontoAtuacao { get; set; } = string.Empty;

        [Required]
        public string Telefone { get; set; } = string.Empty;

        [Required]
        public bool? Ativo { get; set; }

        [MaxLength(1_000_000)]
        public string? FotoBase64 { get; set; }
    }
}
