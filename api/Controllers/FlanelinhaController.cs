using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using api.Data;
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
            
        }
    }
}