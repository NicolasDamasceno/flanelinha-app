using api.Dtos.Flanelinha;
using api.Models;

namespace api.Mappers
{
    public static class FlanelinhaMappers
    {
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
                FotoBase64 = flanelinhaDto.FotoBase64,
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
