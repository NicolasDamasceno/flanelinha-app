using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace api.Dtos.Fiscal
{
    public class FiscalDto
    {
            public int IdFiscal { get; set; }
            public string Nome { get; set; } = string.Empty;
            public string Cpf { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public DateTime DataCriacao { get; set; } = DateTime.UtcNow;

    }
}

