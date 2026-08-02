using api.Data;
using api.Interfaces;
using api.Models;

namespace api.Repositories
{
    public class FiscalRepository : RepositoryBase<Fiscal>, IFiscalRepository
    {
        public FiscalRepository(ApplicationDBContext context) : base(context)
        {
        }
    }
}
