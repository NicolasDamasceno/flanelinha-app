using System.ComponentModel.DataAnnotations;

namespace api.Dtos.Flanelinha
{
    public class CreateFlanelinhaDto
    {
        [Required]
        public string Nome { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Cpf { get; set; } = string.Empty;

        [Required]
        public string PontoAtuacao { get; set; } = string.Empty;

        [Required]
        public string Telefone { get; set; } = string.Empty;

        public bool Ativo { get; set; } = true;

        [Required]
        [MinLength(6)]
        public string Senha { get; set; } = "Senha123";
    }
}