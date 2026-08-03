using api.Data;
using api.Interfaces;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Repositories
{
    public class FiscalRepository : RepositoryBase<Fiscal>, IFiscalRepository
    {
        public FiscalRepository(ApplicationDBContext context) : base(context)
        {
        }

        public async Task<Fiscal?> GetByCpfAsync(string cpf, CancellationToken ct = default)
        {
            return await _dbSet.FirstOrDefaultAsync(f => f.Cpf == cpf, ct);
        }
    }
}
