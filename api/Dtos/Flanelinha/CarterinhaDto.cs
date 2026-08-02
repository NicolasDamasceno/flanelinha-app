using api.Enums;

namespace api.Dtos.Flanelinha
{
    public class CarterinhaDto
    {
        public int IdCarterinha { get; set; }
        public int NumeroCarterinha { get; set; }
        public DateTime DataEmissao { get; set; }
        public DateTime DataValidade { get; set; }
        public bool Ativo { get; set; }
        public TipoCarterinha Tipo { get; set; }
    }
}
