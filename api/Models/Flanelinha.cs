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
        public string Email {get; set;} = string.Empty;
        public string Cpf {get; set;} = string.Empty;
        public string PontoAtuacao {get; set;} = string.Empty;
        public string Telefone {get; set;} = string.Empty;
        public bool PrimeiroAcesso {get; set;} = true;
        public bool Ativo {get; set;} = true;
        public string Senha {get; set;} = "Senha123";
        public DateTime DataCadastro {get; set;} = DateTime.UtcNow;
        public int? IdFiscal {get; set;}
        /// <summary>
        /// Base64 cru da foto (JPEG), sem o prefixo "data:image/jpeg;base64,". Esse prefixo é
        /// responsabilidade do cliente na hora de renderizar, não é armazenado.
        /// </summary>
        public string? FotoBase64 {get; set;}
        public List<Carterinha> Carterinhas {get; set;} = new List<Carterinha>();
    }
}