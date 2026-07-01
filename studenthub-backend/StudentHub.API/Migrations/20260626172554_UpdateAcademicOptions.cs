using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudentHub.API.Migrations
{
    /// <inheritdoc />
    public partial class UpdateAcademicOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AcademicOptions_Type_StudyType_Order",
                table: "AcademicOptions");

            migrationBuilder.DropColumn(
                name: "Type",
                table: "AcademicOptions");

            migrationBuilder.AddColumn<int>(
                name: "Years",
                table: "AcademicOptions",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_AcademicOptions_StudyType_Order",
                table: "AcademicOptions",
                columns: new[] { "StudyType", "Order" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AcademicOptions_StudyType_Order",
                table: "AcademicOptions");

            migrationBuilder.DropColumn(
                name: "Years",
                table: "AcademicOptions");

            migrationBuilder.AddColumn<string>(
                name: "Type",
                table: "AcademicOptions",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_AcademicOptions_Type_StudyType_Order",
                table: "AcademicOptions",
                columns: new[] { "Type", "StudyType", "Order" });
        }
    }
}
