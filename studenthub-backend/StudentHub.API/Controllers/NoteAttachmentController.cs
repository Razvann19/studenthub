using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Controllers.Base;
using StudentHub.API.Data;
using StudentHub.API.Services;

namespace StudentHub.API.Controllers;

[Authorize(AuthenticationSchemes = "Entra")]
public class NoteAttachmentController : ApiBaseController
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _config;
    private readonly TextExtractionService _textExtraction;

    public NoteAttachmentController(AppDbContext db, IWebHostEnvironment env, IConfiguration config, TextExtractionService textExtraction)
    {
        _db = db;
        _env = env;
        _config = config;
        _textExtraction = textExtraction;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return Fail("Niciun fișier selectat.");
        var maxMb = 20;
        if (file.Length > maxMb * 1024 * 1024)
            return Fail($"Fișierul depășește {maxMb}MB.");

        var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt" };
        var ext = Path.GetExtension(file.FileName).ToLower();
        if (!allowed.Contains(ext))
            return Fail("Extensie de fișier neacceptată.");

        var allowedMimes = new Dictionary<string, string[]>
        {
            { ".jpg",  new[] { "image/jpeg" } },
            { ".jpeg", new[] { "image/jpeg" } },
            { ".png",  new[] { "image/png" } },
            { ".webp", new[] { "image/webp" } },
            { ".pdf",  new[] { "application/pdf" } },
            { ".doc",  new[] { "application/msword" } },
            { ".docx", new[] { "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } },
            { ".xls",  new[] { "application/vnd.ms-excel" } },
            { ".xlsx", new[] { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } },
            { ".ppt",  new[] { "application/vnd.ms-powerpoint" } },
            { ".pptx", new[] { "application/vnd.openxmlformats-officedocument.presentationml.presentation" } },
            { ".txt",  new[] { "text/plain" } },
        };

        var contentType = file.ContentType.ToLower();
        if (!allowedMimes.TryGetValue(ext, out var validMimes) || !validMimes.Contains(contentType))
            return Fail("Tipul MIME nu corespunde extensiei fișierului.");
        var originalBase = Path.GetFileNameWithoutExtension(file.FileName);
        originalBase = System.Text.RegularExpressions.Regex.Replace(originalBase, @"[^a-zA-Z0-9_\-\s]", "_");
        var safeOriginalName = originalBase.Trim('_').Trim() + ext;

        var uploadsDir = Path.Combine(_env.ContentRootPath, "Uploads", "attachments");
        Directory.CreateDirectory(uploadsDir);

        var fileName = $"{Guid.NewGuid()}{ext}";
        var filePath = Path.Combine(uploadsDir, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
            await file.CopyToAsync(stream);
        
        var fileType = ext.TrimStart('.');
        var extractedText = _textExtraction.ExtractText(filePath, fileType);

        return Success(new
        {
            url = $"/uploads/attachments/{fileName}",
            originalName = safeOriginalName,
            size = file.Length,
            type = fileType,
            extractedText
        });
    }

    [HttpGet("download")]
    [AllowAnonymous]
    public IActionResult Download([FromQuery] string url, [FromQuery] string name)
    {
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(name))
            return BadRequest();

        var fileName = Path.GetFileName(url);
        var filePath = Path.Combine(_env.ContentRootPath, "Uploads", "attachments", fileName);

        if (!System.IO.File.Exists(filePath))
            return NotFound();

        var contentType = GetContentType(Path.GetExtension(name).ToLower());
        return PhysicalFile(filePath, contentType, name);
    }

    private static string GetContentType(string ext) => ext switch
    {
        ".pdf" => "application/pdf",
        ".doc" => "application/msword",
        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls" => "application/vnd.ms-excel",
        ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".ppt" => "application/vnd.ms-powerpoint",
        ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".txt" => "text/plain",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        _ => "application/octet-stream"
    };
}