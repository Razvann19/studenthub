namespace StudentHub.API.Services;

public class NoteIdService
{
    private static readonly char[] AllowedChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".ToCharArray();
    
    // Cuvinte obscene sau nedorite de evitat
    private static readonly HashSet<string> BlockedPatterns = new(StringComparer.OrdinalIgnoreCase)
    {
        "SEX", "XXX", "ASS", "FUK", "FCK", "SHT", "WTF", "OMG"
        // adaugă mai multe după necesitate
    };

    private readonly Random _random = new();

    public string Generate()
    {
        string id;
        do
        {
            id = "NOTE-" + GenerateCode(8);
        } while (ContainsBlockedPattern(id));

        return id;
    }

    private string GenerateCode(int length)
    {
        return new string(Enumerable.Range(0, length)
            .Select(_ => AllowedChars[_random.Next(AllowedChars.Length)])
            .ToArray());
    }

    private bool ContainsBlockedPattern(string id)
    {
        var code = id.Replace("NOTE-", "");
        return BlockedPatterns.Any(p => code.Contains(p, StringComparison.OrdinalIgnoreCase));
    }
}