using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class init : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Fiscals",
                columns: table => new
                {
                    IdFiscal = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nome = table.Column<string>(type: "text", nullable: false),
                    Cpf = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Senha = table.Column<string>(type: "text", nullable: false),
                    DataCriacao = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Fiscals", x => x.IdFiscal);
                });

            migrationBuilder.CreateTable(
                name: "Flanelinhas",
                columns: table => new
                {
                    IdFlanel = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nome = table.Column<string>(type: "text", nullable: false),
                    Cpf = table.Column<string>(type: "text", nullable: false),
                    PontoAtuacao = table.Column<string>(type: "text", nullable: false),
                    Telefone = table.Column<int>(type: "integer", nullable: false),
                    PrimeiroAcesso = table.Column<bool>(type: "boolean", nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    Senha = table.Column<string>(type: "text", nullable: false),
                    DataCadastro = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IdFiscal = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Flanelinhas", x => x.IdFlanel);
                });

            migrationBuilder.CreateTable(
                name: "Carterinhas",
                columns: table => new
                {
                    IdCarterinha = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    IdFlanel = table.Column<int>(type: "integer", nullable: true),
                    NumeroCarterinha = table.Column<int>(type: "integer", nullable: false),
                    DataEmissao = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DataValidade = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    Tipo = table.Column<int>(type: "integer", nullable: false),
                    FlanelinhaIdFlanel = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Carterinhas", x => x.IdCarterinha);
                    table.ForeignKey(
                        name: "FK_Carterinhas_Flanelinhas_FlanelinhaIdFlanel",
                        column: x => x.FlanelinhaIdFlanel,
                        principalTable: "Flanelinhas",
                        principalColumn: "IdFlanel");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Carterinhas_FlanelinhaIdFlanel",
                table: "Carterinhas",
                column: "FlanelinhaIdFlanel");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Carterinhas");

            migrationBuilder.DropTable(
                name: "Fiscals");

            migrationBuilder.DropTable(
                name: "Flanelinhas");
        }
    }
}
