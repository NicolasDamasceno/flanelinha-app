using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class UniqueCpfIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Flanelinhas_Cpf",
                table: "Flanelinhas",
                column: "Cpf",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Fiscals_Cpf",
                table: "Fiscals",
                column: "Cpf",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Flanelinhas_Cpf",
                table: "Flanelinhas");

            migrationBuilder.DropIndex(
                name: "IX_Fiscals_Cpf",
                table: "Fiscals");
        }
    }
}
