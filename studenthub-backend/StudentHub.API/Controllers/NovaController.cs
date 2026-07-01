using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentHub.API.Controllers.Base;
using StudentHub.API.Data;
using StudentHub.API.Models.Entities;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace StudentHub.API.Controllers;

[Authorize(AuthenticationSchemes = "Entra")]
public class NovaController : ApiBaseController
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly HttpClient _http;

    public NovaController(AppDbContext db, IConfiguration config, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _config = config;
        _http = httpClientFactory.CreateClient();
    }

    // ── Conversations ──────────────────────────────

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var user = await GetCurrentUser();
        if (user == null) return Unauthorized();

        var conversations = await _db.AiConversations
            .Where(c => c.UserId == user.Id)
            .OrderByDescending(c => c.UpdatedAt)
            .Select(c => new {
                c.Id, c.Title, c.Category,
                c.CreatedAt, c.UpdatedAt,
                MessageCount = c.Messages.Count
            })
            .ToListAsync();

        return Success(conversations);
    }

    [HttpPost("conversations")]
    public async Task<IActionResult> CreateConversation([FromBody] CreateConversationDto dto)
    {
        var user = await GetCurrentUser();
        if (user == null) return Unauthorized();

        var conversation = new AiConversation
        {
            UserId = user.Id,
            Title = dto.Title ?? "Conversație nouă",
            Category = dto.Category ?? "general",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.AiConversations.Add(conversation);
        await _db.SaveChangesAsync();

        return Success(new { conversation.Id, conversation.Title, conversation.Category });
    }

    [HttpPatch("conversations/{id}")]
    public async Task<IActionResult> RenameConversation(int id, [FromBody] RenameDto dto)
    {
        var user = await GetCurrentUser();
        if (user == null) return Unauthorized();

        var conversation = await _db.AiConversations
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == user.Id);

        if (conversation == null) return Fail("Conversație negăsită.");

        conversation.Title = dto.Title.Trim();
        await _db.SaveChangesAsync();

        return Success(new { conversation.Id, conversation.Title });
    }

    [HttpDelete("conversations/{id}")]
    public async Task<IActionResult> DeleteConversation(int id)
    {
        var user = await GetCurrentUser();
        if (user == null) return Unauthorized();

        var conversation = await _db.AiConversations
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == user.Id);

        if (conversation == null) return Fail("Conversație negăsită.");

        _db.AiConversations.Remove(conversation);
        await _db.SaveChangesAsync();

        return Success(true);
    }

    [HttpGet("conversations/{id}/messages")]
    public async Task<IActionResult> GetMessages(int id)
    {
        var user = await GetCurrentUser();
        if (user == null) return Unauthorized();

        var conversation = await _db.AiConversations
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == user.Id);

        if (conversation == null) return Fail("Conversație negăsită.");

        var messages = await _db.AiMessages
            .Where(m => m.ConversationId == id)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new {
                m.Id, m.Role, m.Content,
                m.AttachmentName, m.AttachmentType,
                m.CreatedAt
            })
            .ToListAsync();

        return Success(messages);
    }

    // ── Chat ──────────────────────────────────────

   [HttpPost("conversations/{id}/chat")]
public async Task<IActionResult> Chat(int id, [FromBody] ChatDto dto)
{
    var user = await GetCurrentUser();
    if (user == null) return Unauthorized();

    var conversation = await _db.AiConversations
        .Include(c => c.Messages)
        .FirstOrDefaultAsync(c => c.Id == id && c.UserId == user.Id);

    if (conversation == null) return Fail("Conversație negăsită.");

    // Verifică dacă e primul mesaj ÎNAINTE de a salva
    var isFirstMessage = !conversation.Messages.Any();

    var systemPrompt = BuildSystemPrompt(conversation.Category, user.FullName);

    var noteContext = "";
    if (!string.IsNullOrEmpty(dto.Message))
    {
        var noteIdMatch = System.Text.RegularExpressions.Regex.Match(
            dto.Message, @"NOTE-[A-Z0-9]{8}");
        if (noteIdMatch.Success)
        {
            var noteId = noteIdMatch.Value;
            var note = await _db.Notes.FirstOrDefaultAsync(n => n.NoteId == noteId);
            if (note != null)
            {
                noteContext = $"\n\nContextul notiței {noteId}:\nText: {note.Text ?? "(fără text)"}\n";
                if (!string.IsNullOrEmpty(note.AttachmentName))
                    noteContext += $"Fișier atașat: {note.AttachmentName}\n";
            }
        }
    }

    var userMessage = new AiMessage
    {
        ConversationId = id,
        Role = "user",
        Content = dto.Message ?? "",
        CreatedAt = DateTime.UtcNow
    };
    _db.AiMessages.Add(userMessage);

    var history = conversation.Messages
        .OrderBy(m => m.CreatedAt)
        .TakeLast(20)
        .Select(m => new { role = m.Role, content = m.Content })
        .ToList<object>();

    var currentMessage = new List<object>
    {
        new { role = "user", content = $"{dto.Message}{noteContext}" }
    };

    var allMessages = history.Concat(currentMessage).ToList();

    var requestBody = new
    {
        model = "claude-sonnet-4-6",
        max_tokens = 1000,
        system = systemPrompt,
        messages = allMessages
    };

    var request = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
    request.Headers.Add("x-api-key", _config["Anthropic:ApiKey"]);
    request.Headers.Add("anthropic-version", "2023-06-01");
    request.Content = new StringContent(
        JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

    var response = await _http.SendAsync(request);
    var responseBody = await response.Content.ReadAsStringAsync();

    if (!response.IsSuccessStatusCode)
        return Fail($"Eroare API: {responseBody}");

    var responseJson = JsonDocument.Parse(responseBody);
    var assistantText = responseJson.RootElement
        .GetProperty("content")[0]
        .GetProperty("text")
        .GetString() ?? "";

    var assistantMessage = new AiMessage
    {
        ConversationId = id,
        Role = "assistant",
        Content = assistantText,
        CreatedAt = DateTime.UtcNow
    };
    _db.AiMessages.Add(assistantMessage);

    // Generează titlu dacă e primul mesaj
    if (isFirstMessage && !string.IsNullOrEmpty(dto.Message))
    {
        try
        {
            var titleRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
            titleRequest.Headers.Add("x-api-key", _config["Anthropic:ApiKey"]);
            titleRequest.Headers.Add("anthropic-version", "2023-06-01");
            titleRequest.Content = new StringContent(
                JsonSerializer.Serialize(new
                {
                    model = "claude-sonnet-4-6",
                    max_tokens = 20,
                    messages = new[]
                    {
                        new { role = "user", content = $"Generează un titlu scurt de maxim 5 cuvinte în română pentru o conversație care începe cu: \"{dto.Message}\". Răspunde DOAR cu titlul, fără ghilimele sau explicații." }
                    }
                }),
                Encoding.UTF8, "application/json");

            var titleResponse = await _http.SendAsync(titleRequest);
            if (titleResponse.IsSuccessStatusCode)
            {
                var titleBody = await titleResponse.Content.ReadAsStringAsync();
                var titleJson = JsonDocument.Parse(titleBody);
                var generatedTitle = titleJson.RootElement
                    .GetProperty("content")[0]
                    .GetProperty("text")
                    .GetString()?.Trim() ?? dto.Message;

                conversation.Title = generatedTitle.Length > 50
                    ? generatedTitle[..50]
                    : generatedTitle;
            }
        }
        catch
        {
            conversation.Title = dto.Message.Length > 50
                ? dto.Message[..50] + "..."
                : dto.Message;
        }
    }

    conversation.UpdatedAt = DateTime.UtcNow;
    await _db.SaveChangesAsync();

    return Success(new { message = assistantText, conversationId = id });
}

    // ── Helpers ───────────────────────────────────

    private string BuildSystemPrompt(string category, string userName)
    {
        var basePrompt = $"Ești Nova, asistentul AI al platformei StudentHub UPT. " +
                         $"Răspunzi în română. Studentul cu care vorbești se numește {userName}. ";

        return category switch
        {
            "mental" => basePrompt +
                "Ești un asistent empatic și de suport emoțional. " +
                "Dacă studentul pare trist, anxios sau stresat, răspunde cu empatie, " +
                "oferă glume ușoare când e potrivit, cuvinte motivaționale și încurajări. " +
                "Ajută studentul să se simtă mai bine și să capete încredere în sine. " +
                "Dacă situația pare gravă, recomandă și consilierul universitar.",

            "notes" => basePrompt +
                "Ești un asistent specializat în explicarea materialelor de studiu. " +
                "Când studentul menționează un ID de notiță (format NOTE-XXXXXXXX), " +
                "analizează conținutul notiței furnizat și răspunde la întrebările despre el. " +
                "Explică concepte, rezumă, clarifică și ajută la înțelegerea materialului.",

            _ => basePrompt +
                "Ajuți studenții cu întrebări despre facultate, cursuri, activități " +
                "și orice alte subiecte academice sau generale."
        };
    }

    private async Task<User?> GetCurrentUser()
    {
        var email = GetCurrentUserEmail();
        if (string.IsNullOrEmpty(email)) return null;
        return await _db.Students.FirstOrDefaultAsync(u => u.Email == email.ToLower());
    }

    // ── DTOs ──────────────────────────────────────
    public class CreateConversationDto
    {
        public string? Title { get; set; }
        public string? Category { get; set; }
    }

    public class RenameDto
    {
        public string Title { get; set; } = string.Empty;
    }

    public class ChatDto
    {
        public string? Message { get; set; }
    }
}