using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace api.Models
{
    public class Flanelinha
    {
        [Key]
        public int IdFlanel {get; set;}
        public string Nome {get; set;} = string.Empty;
        public string Cpf {get; set;} = string.Empty;
        public string PontoAtuacao {get; set;} = string.Empty;
        public int Telefone {get; set;}
        public bool PrimeiroAcesso {get; set;} = true;
        public bool Ativo {get; set;} = false;
        public string Senha {get; set;} = string.Empty;
        public DateTime DataCadastro {get; set;} = DateTime.UtcNow;
        public int? IdFiscal {get; set;}
        public List<Carterinha> Carterinhas {get; set;} = new List<Carterinha>();
    }
}