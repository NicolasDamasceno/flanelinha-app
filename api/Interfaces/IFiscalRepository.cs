using api.Models;

namespace api.Interfaces
{
    public interface IFiscalRepository : IRepository<Fiscal>
    {
        Task<Fiscal?> GetByCpfAsync(string cpf, CancellationToken ct = default);
    }
}
