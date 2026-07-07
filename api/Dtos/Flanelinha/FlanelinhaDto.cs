using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using api.Models;

namespace api.Dtos.Flanelinha
{
    public class FlanelinhaDto
    {
        public int IdFlanel { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Cpf { get; set; } = string.Empty;
        public string PontoAtuacao { get; set; } = string.Empty;
        public int Telefone { get; set; }
        public bool Ativo { get; set; } = false;
        public DateTime DataCadastro { get; set; } = DateTime.UtcNow;
        public int? IdFiscal { get; set; }
        public List<Carterinha> Carterinhas { get; set; } = new List<Carterinha>();
    }
}