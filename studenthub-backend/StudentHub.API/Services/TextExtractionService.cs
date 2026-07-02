using UglyToad.PdfPig;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace StudentHub.API.Services;

public class TextExtractionService
{
    public string? ExtractText(string filePath, string? fileType)
    {
        try
        {
            if (fileType == "pdf")
                return ExtractFromPdf(filePath);
            if (fileType == "docx" || fileType == "doc")
                return ExtractFromDocx(filePath);
            return null;
        }
        catch
        {
            return null;
        }
    }

    private string ExtractFromPdf(string filePath)
    {
        using var pdf = PdfDocument.Open(filePath);
        var text = string.Join(" ", pdf.GetPages().Select(p => p.Text));
        return text.Length > 5000 ? text[..5000] : text;
    }

    private string ExtractFromDocx(string filePath)
    {
        using var doc = WordprocessingDocument.Open(filePath, false);
        var body = doc.MainDocumentPart?.Document?.Body;
        if (body == null) return string.Empty;
        var text = string.Join(" ", body.Descendants<Text>().Select(t => t.Text));
        return text.Length > 5000 ? text[..5000] : text;
    }
}