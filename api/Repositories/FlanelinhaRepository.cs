using api.Data;
using api.Dtos.Flanelinha;
using api.Interfaces;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Repositories
{
    public class FlanelinhaRepository : RepositoryBase<Flanelinha>, IFlanelinhaRepository
    {
        public FlanelinhaRepository(ApplicationDBContext context) : base(context)
        {
        }

        public async Task<Flanelinha?> GetByCpfAsync(string cpf, CancellationToken ct = default)
        {
            return await _dbSet.FirstOrDefaultAsync(f => f.Cpf == cpf, ct);
        }

        /// <summary>
        /// Projeta direto pra DTO no LINQ (em vez de usar ToFlanelinhaDto()) de propósito: o EF Core
        /// não traduz chamada de extension method dentro do Select, e é justamente a projeção no SQL
        /// que garante que a coluna FotoBase64 nunca seja lida nesta query. FotoBase64 fica null aqui
        /// por decisão de design — só GetById/GetMe trazem os bytes reais. Ver design doc, seção 1.
        /// </summary>
        public async Task<List<FlanelinhaDto>> GetAllByFiscalWithCarterinhasAsync(int idFiscal, CancellationToken ct = default)
        {
            return await _dbSet
                .Where(f => f.IdFiscal == idFiscal)
                .Select(f => new FlanelinhaDto
                {
                    IdFlanel = f.IdFlanel,
                    Nome = f.Nome,
                    Email = f.Email,
                    Cpf = f.Cpf,
                    PontoAtuacao = f.PontoAtuacao,
                    Telefone = f.Telefone,
                    Ativo = f.Ativo,
                    DataCadastro = f.DataCadastro,
                    IdFiscal = f.IdFiscal,
                    FotoBase64 = null, // proposital: foto nunca é carregada na lista
                    Carterinhas = f.Carterinhas.Select(c => new CarterinhaDto
                    {
                        IdCarterinha = c.IdCarterinha,
                        NumeroCarterinha = c.NumeroCarterinha,
                        DataEmissao = c.DataEmissao,
                        DataValidade = c.DataValidade,
                        Ativo = c.Ativo,
                        Tipo = c.Tipo
                    }).ToList()
                })
                .ToListAsync(ct);
        }

        public async Task<Flanelinha?> GetByIdWithCarterinhasAsync(int id, CancellationToken ct = default)
        {
            return await _dbSet
                .Include(f => f.Carterinhas)
                .FirstOrDefaultAsync(f => f.IdFlanel == id, ct);
        }

        public async Task<Carterinha?> GetCarterinhaAtivaAsync(int idFlanel, CancellationToken ct = default)
        {
            return await _context.Carterinhas
                .Where(c => c.IdFlanel == idFlanel && c.Ativo)
                .OrderByDescending(c => c.DataEmissao)
                .FirstOrDefaultAsync(ct);
        }

        public async Task AddCarterinhaAsync(Carterinha carterinha, CancellationToken ct = default)
        {
            await _context.Carterinhas.AddAsync(carterinha, ct);
        }

        public async Task<int> GetProximoNumeroCarterinhaAsync(CancellationToken ct = default)
        {
            var maiorNumero = await _context.Carterinhas.MaxAsync(c => (int?)c.NumeroCarterinha, ct);
            return (maiorNumero ?? 0) + 1;
        }
    }
}
