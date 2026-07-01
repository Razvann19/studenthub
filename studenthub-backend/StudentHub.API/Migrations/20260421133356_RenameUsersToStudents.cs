using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudentHub.API.Migrations
{
    /// <inheritdoc />
    public partial class RenameUsersToStudents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_Users",
                table: "Users");

            migrationBuilder.RenameTable(
                name: "Users",
                newName: "Students");

            migrationBuilder.RenameIndex(
                name: "IX_Users_EntraObjectId",
                table: "Students",
                newName: "IX_Students_EntraObjectId");

            migrationBuilder.RenameIndex(
                name: "IX_Users_Email",
                table: "Students",
                newName: "IX_Students_Email");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Students",
                table: "Students",
                column: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_Students",
                table: "Students");

            migrationBuilder.RenameTable(
                name: "Students",
                newName: "Users");

            migrationBuilder.RenameIndex(
                name: "IX_Students_EntraObjectId",
                table: "Users",
                newName: "IX_Users_EntraObjectId");

            migrationBuilder.RenameIndex(
                name: "IX_Students_Email",
                table: "Users",
                newName: "IX_Users_Email");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Users",
                table: "Users",
                column: "Id");
        }
    }
}
