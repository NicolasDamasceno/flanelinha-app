using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using api.Dtos.Flanelinha;
using api.Models;

namespace api.Mappers
{
    public static class FlanelinhaMappers
    {
        public static Flanelinha ToFlanelinhaDto(this Flanelinha flanelinhaModel)
        {
            return new Flanelinha
            {
                IdFlanel = flanelinhaModel.IdFlanel,
                Nome = flanelinhaModel.Nome,
                Cpf = flanelinhaModel.Cpf,
                PontoAtuacao = flanelinhaModel.PontoAtuacao,
                Telefone = flanelinhaModel.Telefone,
                Ativo = flanelinhaModel.Ativo,
                DataCadastro = flanelinhaModel.DataCadastro,
                IdFiscal = flanelinhaModel.IdFiscal,
                Carterinhas = flanelinhaModel.Carterinhas
            };
        }
       
        public static Flanelinha ToCreateFlanelinhaDto(this CreateFlanelinhaDto flanelinhaDto)
        {
            return new Flanelinha
            {
                Nome = flanelinhaDto.Nome,
                Cpf = flanelinhaDto.Cpf,
                PontoAtuacao = flanelinhaDto.PontoAtuacao,
                Telefone = flanelinhaDto.Telefone,
                Ativo = flanelinhaDto.Ativo,
                Senha = flanelinhaDto.Senha,
                DataCadastro = DateTime.UtcNow,
                IdFiscal = flanelinhaDto.IdFiscal
            };
        }
    }
}