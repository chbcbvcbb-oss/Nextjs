// Minimal ASP.NET Core server demonstrating the standard file upload pattern
// that exposes the multipart form value memory exhaustion vulnerability.
//
// This configuration is recommended by Microsoft's own documentation:
// https://learn.microsoft.com/en-us/aspnet/core/mvc/models/file-uploads

using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenLocalhost(5000, listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http1AndHttp2;
    });

    // Standard pattern for file upload endpoints — disables request body size limit
    // Without this, large file uploads are rejected by the default 30MB limit
    options.Limits.MaxRequestBodySize = null;
});

var app = builder.Build();

app.MapGet("/", () => "Hello World!");

app.MapGet("/memory", () =>
{
    var proc = System.Diagnostics.Process.GetCurrentProcess();
    return Results.Ok(new
    {
        pid = Environment.ProcessId,
        workingSetMB = proc.WorkingSet64 / 1024 / 1024,
        gcTotalMB = GC.GetTotalMemory(false) / 1024 / 1024,
    });
});

// Standard file upload endpoint — accepts multipart form data
app.MapPost("/upload", async (HttpRequest request) =>
{
    var form = await request.ReadFormAsync();
    return Results.Ok(new { fields = form.Count, files = form.Files.Count });
}).DisableAntiforgery();

Console.WriteLine($"Server PID: {Environment.ProcessId}");
Console.WriteLine("Listening on http://localhost:5000");
Console.WriteLine($"MaxRequestBodySize: null (unlimited — standard for file uploads)");
app.Run();
