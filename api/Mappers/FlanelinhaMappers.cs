using api.Dtos.Flanelinha;
using api.Models;

namespace api.Mappers
{
    // ATENÇÃO: existe uma segunda projeção Flanelinha -> FlanelinhaDto, escrita à mão dentro do
    // LINQ em FlanelinhaRepository.GetAllByFiscalWithCarterinhasAsync (o EF não traduz estes
    // mappers). Campo novo no DTO precisa ser adicionado NOS DOIS lugares — exceto FotoBase64,
    // que é null lá de propósito.
    public static class FlanelinhaMappers
    {
        public static string? NormalizeFotoBase64(string? value)
        {
            if (value == null) return null;
            var commaIndex = value.IndexOf(',');
            return value.StartsWith("data:") && commaIndex >= 0 ? value[(commaIndex + 1)..] : value;
        }

        public static FlanelinhaDto ToFlanelinhaDto(this Flanelinha flanelinhaModel)
        {
            return new FlanelinhaDto
            {
                IdFlanel = flanelinhaModel.IdFlanel,
                Nome = flanelinhaModel.Nome,
                Email = flanelinhaModel.Email,
                Cpf = flanelinhaModel.Cpf,
                PontoAtuacao = flanelinhaModel.PontoAtuacao,
                Telefone = flanelinhaModel.Telefone,
                Ativo = flanelinhaModel.Ativo,
                DataCadastro = flanelinhaModel.DataCadastro,
                IdFiscal = flanelinhaModel.IdFiscal,
                FotoBase64 = flanelinhaModel.FotoBase64,
                Carterinhas = flanelinhaModel.Carterinhas.Select(c => c.ToCarterinhaDto()).ToList()
            };
        }

        public static Flanelinha ToCreateFlanelinhaDto(this CreateFlanelinhaDto flanelinhaDto)
        {
            return new Flanelinha
            {
                Nome = flanelinhaDto.Nome,
                Email = flanelinhaDto.Email,
                Cpf = flanelinhaDto.Cpf,
                PontoAtuacao = flanelinhaDto.PontoAtuacao,
                Telefone = flanelinhaDto.Telefone,
                Ativo = flanelinhaDto.Ativo,
                Senha = flanelinhaDto.Senha,
                FotoBase64 = NormalizeFotoBase64(flanelinhaDto.FotoBase64),
                DataCadastro = DateTime.UtcNow
            };
        }

        public static CarterinhaDto ToCarterinhaDto(this Carterinha carterinhaModel)
        {
            return new CarterinhaDto
            {
                IdCarterinha = carterinhaModel.IdCarterinha,
                NumeroCarterinha = carterinhaModel.NumeroCarterinha,
                DataEmissao = carterinhaModel.DataEmissao,
                DataValidade = carterinhaModel.DataValidade,
                Ativo = carterinhaModel.Ativo,
                Tipo = carterinhaModel.Tipo
            };
        }
    }
}
