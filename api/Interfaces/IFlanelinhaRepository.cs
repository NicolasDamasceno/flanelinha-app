using api.Models;

namespace api.Interfaces
{
    public interface IFlanelinhaRepository : IRepository<Flanelinha>
    {
        Task<Flanelinha?> GetByCpfAsync(string cpf, CancellationToken ct = default);
        Task<List<Flanelinha>> GetAllByFiscalWithCarterinhasAsync(int idFiscal, CancellationToken ct = default);
        Task<Flanelinha?> GetByIdWithCarterinhasAsync(int id, CancellationToken ct = default);
        Task<Carterinha?> GetCarterinhaAtivaAsync(int idFlanel, CancellationToken ct = default);
        Task AddCarterinhaAsync(Carterinha carterinha, CancellationToken ct = default);
        Task<int> GetProximoNumeroCarterinhaAsync(CancellationToken ct = default);
    }
}
