using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudentHub.API.Controllers.Base;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace StudentHub.API.Controllers;

[Authorize(AuthenticationSchemes = "Entra")]
public class NovaSimpleController : ApiBaseController
{
    private readonly IConfiguration _config;
    private readonly HttpClient _http;

    public NovaSimpleController(IConfiguration config, IHttpClientFactory factory)
    {
        _config = config;
        _http = factory.CreateClient();
    }

    [HttpPost("simple")]
    public async Task<IActionResult> Simple([FromBody] SimpleRequest request)
    {
        var apiKey = _config["Anthropic:ApiKey"];

        var systemPrompt = $"Ești Nova, asistentul AI al platformei StudentHub UPT. " +
            $"Vorbești cu {request.UserName}. Fii prietenos și concis. " +
            $"Aceasta este o conversație rapidă din popup — răspunsurile să fie scurte.";

        var body = new
        {
            model = "claude-opus-4-6",
            max_tokens = 500,
            system = systemPrompt,
            messages = request.Messages.Select(m => new { role = m.Role, content = m.Content }).ToList()
        };

        var json = JsonSerializer.Serialize(body);
        var httpRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
        httpRequest.Headers.Add("x-api-key", apiKey);
        httpRequest.Headers.Add("anthropic-version", "2023-06-01");
        httpRequest.Content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _http.SendAsync(httpRequest);
        var responseJson = await response.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(responseJson);
        var text = doc.RootElement
            .GetProperty("content")[0]
            .GetProperty("text")
            .GetString() ?? "";

        return Success(text);
    }
}

public class SimpleRequest
{
    public List<SimpleMessage> Messages { get; set; } = new();
    public string UserName { get; set; } = "";
}

public class SimpleMessage
{
    public string Role { get; set; } = "";
    public string Content { get; set; } = "";
}