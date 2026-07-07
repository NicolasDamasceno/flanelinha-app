using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using api.Data;
using api.Dtos.Fiscal;
using api.Mappers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace api.Controllers
{
    [Route("api/fiscal")]
    [ApiController]
    public class FiscalController : ControllerBase
    {
        private readonly ApplicationDBContext _context;

        public FiscalController(ApplicationDBContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult GetAll()
        {
            var fiscals = _context.Fiscals.ToList();

            return Ok(fiscals);
        }

        [HttpGet("{id}")]
        public IActionResult GetById(int id)
        {
            var fiscal = _context.Fiscals.FirstOrDefault(f => f.IdFiscal == id);

            if (fiscal == null)
            {
                return NotFound();
            }

            return Ok(fiscal);
        }

        [HttpPost]
        public IActionResult Create([FromBody] CreateFiscalDto fiscalDto)
        {
            var fiscal = fiscalDto.ToCreateFiscalDto();
            _context.Fiscals.Add(fiscal);
            _context.SaveChanges();

            return CreatedAtAction(nameof(GetById), new { id = fiscal.IdFiscal }, fiscal.ToFiscalDto());
        }

        [HttpPut("{id}")]
        public IActionResult Update(int id, [FromBody] UpdateFiscalDto UpdateFiscalDto)
        {
            var fiscal = _context.Fiscals.FirstOrDefault(f => f.IdFiscal == id);

            if (fiscal == null)
            {
                return NotFound();
            }

            fiscal.Nome = UpdateFiscalDto.Nome;
            fiscal.Cpf = UpdateFiscalDto.Cpf;
            fiscal.Email = UpdateFiscalDto.Email;
            fiscal.Senha = UpdateFiscalDto.Senha;

            return Ok(fiscal.ToFiscalDto());
        }

        [HttpDelete("{id}")]
        public IActionResult Delete(int id)
        {
            var fiscal = _context.Fiscals.FirstOrDefault(f => f.IdFiscal == id);

            if (fiscal == null)
            {
                return NotFound();
            }

            _context.Fiscals.Remove(fiscal);
            _context.SaveChanges();

            return NoContent();
        }
    }
}