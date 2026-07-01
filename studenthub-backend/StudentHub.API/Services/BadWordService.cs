using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StudentHub.API.Data;

namespace StudentHub.API.Services;

public class BadWordService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private List<string> _cache = new();
    private DateTime _cacheTime = DateTime.MinValue;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public BadWordService(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    private async Task RefreshCacheAsync()
    {
        if ((DateTime.UtcNow - _cacheTime).TotalMinutes < 5) return;

        await _lock.WaitAsync();
        try
        {
            if ((DateTime.UtcNow - _cacheTime).TotalMinutes < 5) return;
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            _cache = await db.BadWords.Select(w => w.Word.ToLower()).ToListAsync();
            _cacheTime = DateTime.UtcNow;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<bool> ContainsBadWordAsync(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        await RefreshCacheAsync();
        var lower = text.ToLower();
        return _cache.Any(w => lower.Contains(w));
    }

    public void InvalidateCache()
    {
        _cacheTime = DateTime.MinValue;
    }
}