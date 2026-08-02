using System;
using System.Collections.Generic;

namespace api.Dtos.Flanelinha
{
    public class FlanelinhaDto
    {
        public int IdFlanel { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Cpf { get; set; } = string.Empty;
        public string PontoAtuacao { get; set; } = string.Empty;
        public string Telefone { get; set; } = string.Empty;
        public bool Ativo { get; set; } = false;
        public DateTime DataCadastro { get; set; } = DateTime.UtcNow;
        public int? IdFiscal { get; set; }
        public List<CarterinhaDto> Carterinhas { get; set; } = new List<CarterinhaDto>();
    }
}
