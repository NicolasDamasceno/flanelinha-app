using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using api.Models;
using Microsoft.EntityFrameworkCore;

namespace api.Data
{
    public class ApplicationDBContext: DbContext
    {
        public ApplicationDBContext(DbContextOptions dbContextOptions)
        : base(dbContextOptions)
        {
            
        }

        public DbSet<Fiscal> Fiscals {get; set;} = null!;
        public DbSet<Flanelinha> Flanelinhas {get; set;} = null!;
        public DbSet<Carterinha> Carterinhas {get; set;} = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Flanelinha>()
                .HasMany(f => f.Carterinhas)
                .WithOne()
                .HasForeignKey(c => c.IdFlanel);

            modelBuilder.Entity<Carterinha>()
                .HasIndex(c => c.NumeroCarterinha)
                .IsUnique();
        }
    }
}