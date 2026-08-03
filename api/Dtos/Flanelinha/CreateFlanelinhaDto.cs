using System.ComponentModel.DataAnnotations;

namespace api.Dtos.Flanelinha
{
    public class CreateFlanelinhaDto
    {
        public string Nome { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Cpf { get; set; } = string.Empty;
        public string PontoAtuacao { get; set; } = string.Empty;
        public string Telefone { get; set; } = string.Empty;
        public bool Ativo { get; set; } = true;

        [Required]
        [MinLength(6)]
        public string Senha { get; set; } = "Senha123";
    }
}