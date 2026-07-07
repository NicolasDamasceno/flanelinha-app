using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Threading.Tasks;

namespace api.Models
{
    public class Fiscal
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int IdFiscal { get; set;}
        public string Nome { get; set; } = string.Empty;
        public string Cpf {get; set;} = string.Empty;
        public string Email {get; set;} = string.Empty;
        public string OrgaoVinculado {get; set;} = string.Empty;
        public string Senha {get; set;} = string.Empty;
        public DateTime DataCriacao {get; set;} = DateTime.UtcNow;

    }
}