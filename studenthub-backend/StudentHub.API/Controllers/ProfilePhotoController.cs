using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Controllers.Base;
using StudentHub.API.Data;
using SkiaSharp;

namespace StudentHub.API.Controllers;

[Authorize(AuthenticationSchemes = "Entra")]
public class ProfilePhotoController : ApiBaseController
{
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _config;

    public ProfilePhotoController(AppDbContext db, IWebHostEnvironment env, IConfiguration config)
    {
        _db = db;
        _env = env;
        _config = config;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return Fail("Niciun fișier selectat.");

        var maxMb = _config.GetValue<int>("FileStorage:MaxFileSizeMB");
        if (file.Length > maxMb * 1024 * 1024)
            return Fail($"Fișierul depășește {maxMb}MB.");

        var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        var ext = Path.GetExtension(file.FileName).ToLower();
        if (!allowed.Contains(ext))
            return Fail("Doar fișiere JPG, PNG sau WEBP.");

        var email = GetCurrentUserEmail();
        if (string.IsNullOrEmpty(email))
            return Fail("Neautorizat.", 401);

        var user = await _db.Students.FirstOrDefaultAsync(u => u.Email == email.ToLower());
        if (user == null)
            return Fail("Utilizatorul nu a fost găsit.", 404);
        
        if (!string.IsNullOrEmpty(user.ProfilePhotoUrl))
        {
            var oldPath = Path.Combine(_env.ContentRootPath, "Uploads", user.ProfilePhotoUrl);
            if (System.IO.File.Exists(oldPath))
                System.IO.File.Delete(oldPath);
        }
        
        var uploadsDir = Path.Combine(_env.ContentRootPath, "Uploads", "profiles");
        Directory.CreateDirectory(uploadsDir);

        var fileName = $"user-{user.Id}.png"; // ← schimbă din .webp în .png
        var filePath = Path.Combine(uploadsDir, fileName);

        using (var inputStream = file.OpenReadStream())
        using (var original = SKBitmap.Decode(inputStream))
        {
            var size = Math.Min(original.Width, original.Height);
            var x = (original.Width - size) / 2;
            var y = (original.Height - size) / 2;

            using var cropped = new SKBitmap(size, size);
            using (var canvas = new SKCanvas(cropped))
            {
                canvas.DrawBitmap(original, new SKRect(x, y, x + size, y + size), new SKRect(0, 0, size, size));
            }

            using var resized = cropped.Resize(new SKImageInfo(512, 512), SKFilterQuality.High);
            using var image = SKImage.FromBitmap(resized);
            using var data = image.Encode(SKEncodedImageFormat.Png, 100);
            using var fileStream = new FileStream(filePath, FileMode.Create);
            data.SaveTo(fileStream);
        }
        
        user.ProfilePhotoUrl = $"profiles/{fileName}";
        await _db.SaveChangesAsync();

        return Success(new { url = $"/uploads/{user.ProfilePhotoUrl}" });
    }

    [HttpDelete]
    public async Task<IActionResult> Delete()
    {
        var email = GetCurrentUserEmail();
        if (string.IsNullOrEmpty(email)) return Fail("Neautorizat.", 401);

        var user = await _db.Students.FirstOrDefaultAsync(u => u.Email == email.ToLower());
        if (user == null) return Fail("Utilizatorul nu a fost găsit.", 404);

        if (!string.IsNullOrEmpty(user.ProfilePhotoUrl))
        {
            var path = Path.Combine(_env.ContentRootPath, "Uploads", user.ProfilePhotoUrl);
            if (System.IO.File.Exists(path))
                System.IO.File.Delete(path);

            user.ProfilePhotoUrl = null;
            await _db.SaveChangesAsync();
        }

        return Success();
    }
}