using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using api.Dtos.Fiscal;
using api.Models;

namespace api.Mappers
{
    public static class FiscalMappers
    {
        public static FiscalDto ToFiscalDto(this Fiscal fiscalModel)
        {
            return new FiscalDto
            {
                IdFiscal = fiscalModel.IdFiscal,
                Nome = fiscalModel.Nome,
                Cpf = fiscalModel.Cpf,
                Email = fiscalModel.Email,
                DataCriacao = fiscalModel.DataCriacao
            };
        }

        public static Fiscal ToCreateFiscalDto(this CreateFiscalDto fiscalDto)
        {
            return new Fiscal
            {
                Nome = fiscalDto.Nome,
                Cpf = fiscalDto.Cpf,
                Email = fiscalDto.Email,
                Senha = fiscalDto.Senha,
                DataCriacao = DateTime.UtcNow,
            };
        }
    }
}