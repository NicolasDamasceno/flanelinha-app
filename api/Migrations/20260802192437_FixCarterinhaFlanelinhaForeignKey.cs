using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class FixCarterinhaFlanelinhaForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE \"Carterinhas\" SET \"IdFlanel\" = \"FlanelinhaIdFlanel\" WHERE \"IdFlanel\" IS NULL AND \"FlanelinhaIdFlanel\" IS NOT NULL;");

            migrationBuilder.DropForeignKey(
                name: "FK_Carterinhas_Flanelinhas_FlanelinhaIdFlanel",
                table: "Carterinhas");

            migrationBuilder.DropIndex(
                name: "IX_Carterinhas_FlanelinhaIdFlanel",
                table: "Carterinhas");

            migrationBuilder.DropColumn(
                name: "FlanelinhaIdFlanel",
                table: "Carterinhas");

            migrationBuilder.CreateIndex(
                name: "IX_Carterinhas_IdFlanel",
                table: "Carterinhas",
                column: "IdFlanel");

            migrationBuilder.CreateIndex(
                name: "IX_Carterinhas_NumeroCarterinha",
                table: "Carterinhas",
                column: "NumeroCarterinha",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Carterinhas_Flanelinhas_IdFlanel",
                table: "Carterinhas",
                column: "IdFlanel",
                principalTable: "Flanelinhas",
                principalColumn: "IdFlanel");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Carterinhas_Flanelinhas_IdFlanel",
                table: "Carterinhas");

            migrationBuilder.DropIndex(
                name: "IX_Carterinhas_IdFlanel",
                table: "Carterinhas");

            migrationBuilder.DropIndex(
                name: "IX_Carterinhas_NumeroCarterinha",
                table: "Carterinhas");

            migrationBuilder.AddColumn<int>(
                name: "FlanelinhaIdFlanel",
                table: "Carterinhas",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Carterinhas_FlanelinhaIdFlanel",
                table: "Carterinhas",
                column: "FlanelinhaIdFlanel");

            migrationBuilder.AddForeignKey(
                name: "FK_Carterinhas_Flanelinhas_FlanelinhaIdFlanel",
                table: "Carterinhas",
                column: "FlanelinhaIdFlanel",
                principalTable: "Flanelinhas",
                principalColumn: "IdFlanel");
        }
    }
}
