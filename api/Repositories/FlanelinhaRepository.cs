using api.Data;
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

        public async Task<List<Flanelinha>> GetAllWithCarterinhasAsync(CancellationToken ct = default)
        {
            return await _dbSet.Include(f => f.Carterinhas).ToListAsync(ct);
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
            var maiorNumero = await _context.Carterinhas
                .MaxAsync(c => (int?)c.NumeroCarterinha, ct);
            return (maiorNumero ?? 0) + 1;
        }
    }
}
