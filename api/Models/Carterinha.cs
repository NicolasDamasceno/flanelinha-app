using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using api.Enums;

namespace api.Models
{
    public class Carterinha
    {
        [Key]
        public int IdCarterinha { get; set; }
        public int? IdFlanel { get; set; }
        public int NumeroCarterinha { get; set; }
        public DateTime DataEmissao { get; set; } = DateTime.UtcNow;
        public DateTime DataValidade { get; set; } = DateTime.UtcNow.AddYears(1);
        public bool Ativo { get; set; } = true;
        public TipoCarterinha Tipo { get; set; } = TipoCarterinha.PrimeiraVia;
    }
}