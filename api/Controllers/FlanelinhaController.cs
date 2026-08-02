using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using api.Data;
using api.Dtos.Flanelinha;
using api.Mappers;
using Microsoft.AspNetCore.Mvc;

namespace api.Controllers
{
    [Route("api/flanelinha")]
    [ApiController]
    public class FlanelinhaController : ControllerBase
    {
        private readonly ApplicationDBContext _context;

        public FlanelinhaController(ApplicationDBContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult GetAll()
        {
            var flanelinhas = _context.Flanelinhas.ToList();

            return Ok(flanelinhas);
        }

        [HttpGet("{id}")]
        public IActionResult GetById(int id)
        {
            var flanelinha = _context.Flanelinhas.FirstOrDefault(f => f.IdFlanel == id);

            if (flanelinha == null)
            {
                return NotFound();
            }

            return Ok(flanelinha);
        }

        [HttpPost]
        public IActionResult Create([FromBody] CreateFlanelinhaDto flanelinhaDto)
        {
            var flanelinha = flanelinhaDto.ToCreateFlanelinhaDto();
            _context.Flanelinhas.Add(flanelinha);
            _context.SaveChanges();

            return CreatedAtAction(nameof(GetById), new { id = flanelinha.IdFlanel }, flanelinha.ToFlanelinhaDto());
        }
    }
}