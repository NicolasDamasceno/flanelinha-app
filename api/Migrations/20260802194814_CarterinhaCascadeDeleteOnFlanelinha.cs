using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class CarterinhaCascadeDeleteOnFlanelinha : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Carterinhas_Flanelinhas_IdFlanel",
                table: "Carterinhas");

            migrationBuilder.AddForeignKey(
                name: "FK_Carterinhas_Flanelinhas_IdFlanel",
                table: "Carterinhas",
                column: "IdFlanel",
                principalTable: "Flanelinhas",
                principalColumn: "IdFlanel",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Carterinhas_Flanelinhas_IdFlanel",
                table: "Carterinhas");

            migrationBuilder.AddForeignKey(
                name: "FK_Carterinhas_Flanelinhas_IdFlanel",
                table: "Carterinhas",
                column: "IdFlanel",
                principalTable: "Flanelinhas",
                principalColumn: "IdFlanel");
        }
    }
}
