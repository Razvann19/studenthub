using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudentHub.API.Migrations
{
    /// <inheritdoc />
    public partial class AddNoteAttachment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AttachmentName",
                table: "Notes",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AttachmentType",
                table: "Notes",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AttachmentUrl",
                table: "Notes",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AttachmentName",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "AttachmentType",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "AttachmentUrl",
                table: "Notes");
        }
    }
}
