# ASP.NET Core Default-Config Multipart Form Value Memory Exhaustion (OOM DoS)

## Summary

ASP.NET Core's multipart form parsing reads form field values into memory via
`StreamReader.ReadToEndAsync()` with **no per-value size limit**. While
`FormOptions.ValueLengthLimit` (4MB default) protects URL-encoded forms, the
multipart code path bypasses this check entirely. Combined with automatic
antiforgery token validation in Razor Pages (which calls `ReadFormAsync()` for
all POST requests), a completely **default** `dotnet new webapp` application can
be crashed via unauthenticated multipart POST requests with **zero configuration
changes**.

## Severity

**Important** -- Unauthenticated Remote Denial of Service (Complete Unavailability)

- **Anonymous attacker**: No authentication required
- **Default/Common configuration**: Works on `dotnet new webapp` with no changes
- **Permanent DoS**: Server process is OOM-killed, requires restart
- **SDL Bug Bar**: Anonymous + Default + Permanent DoS = Important

## Affected Components

- `Microsoft.AspNetCore.Http` -- `FormFeature.InnerReadFormAsync()` (unbounded string read)
- `Microsoft.AspNetCore.WebUtilities` -- `MultipartSectionStreamExtensions.ReadAsStringAsync()`
- `Microsoft.AspNetCore.Antiforgery` -- `DefaultAntiforgeryTokenStore.GetRequestTokensAsync()` (trigger)
- `Microsoft.AspNetCore.Mvc.RazorPages` -- `AutoValidateAntiforgeryPageApplicationModelProvider` (auto-applies filter)
- All ASP.NET Core versions with Razor Pages multipart form parsing

## Attack Vector

### Zero-Config Attack Chain

1. Attacker sends `POST /Index` (or any Razor Page) with `Content-Type: multipart/form-data`
2. Razor Pages' auto-applied `AutoValidateAntiforgeryTokenAttribute` filter runs
3. Filter calls `IAntiforgery.ValidateRequestAsync()` to check antiforgery token
4. `DefaultAntiforgeryTokenStore.GetRequestTokensAsync()` calls `ReadFormAsync()` to find the token in the form body
5. `FormFeature.InnerReadFormAsync()` parses the multipart body
6. Each form field value is read via `StreamReader.ReadToEndAsync()` with **NO size limit**
7. UTF-8 ASCII data becomes UTF-16 .NET strings (2x memory amplification)
8. Antiforgery validation fails (400 response), but memory is already allocated
9. Concurrent requests multiply memory: 100 x 30MB body x 2 (UTF-16) = 6GB+
10. Server process is OOM-killed

### Key Insight: No Endpoint Configuration Needed

The default Razor Pages template auto-applies antiforgery validation to **all pages** via
`AutoValidateAntiforgeryPageApplicationModelProvider`. Even pages with only `OnGet()` handlers
(like the default Index page) will have their form body read when receiving a POST request,
because the antiforgery filter runs as an authorization filter **before** handler selection.

## Root Cause

### The Inconsistency

`FormOptions` defines `ValueLengthLimit` (default 4MB) to cap per-value memory:

```csharp
// FormOptions.cs
public int ValueLengthLimit { get; set; } = DefaultValueLengthLimit; // 4MB
```

This limit is correctly enforced for **URL-encoded** forms via `FormPipeReader`:

```csharp
// FormFeature.cs line ~216 (URL-encoded path)
var formReader = new FormPipeReader(_request.BodyReader, encoding)
{
    ValueCountLimit = _options.ValueCountLimit,
    KeyLengthLimit = _options.KeyLengthLimit,
    ValueLengthLimit = _options.ValueLengthLimit,  // ENFORCED
};
```

But for **multipart** forms, `ValueLengthLimit` is never applied:

```csharp
// FormFeature.cs line ~229 (multipart path)
var multipartReader = new MultipartReader(boundary, _request.Body)
{
    HeadersCountLimit = _options.MultipartHeadersCountLimit,
    HeadersLengthLimit = _options.MultipartHeadersLengthLimit,
    BodyLengthLimit = _options.MultipartBodyLengthLimit,
    // NO ValueLengthLimit, NO KeyLengthLimit
};
```

### The Unbounded Read

Form field values are read with no size limit:

```csharp
// FormFeature.cs line ~293
var value = await formDataSection.GetValueAsync(cancellationToken);

// FormMultipartSection.cs line ~63
public ValueTask<string> GetValueAsync(CancellationToken cancellationToken)
    => Section.ReadAsStringAsync(cancellationToken);

// MultipartSectionStreamExtensions.cs line ~52
return await reader.ReadToEndAsync(cancellationToken);  // NO SIZE LIMIT
```

### The Trigger (Antiforgery Auto-Validation)

```csharp
// AutoValidateAntiforgeryPageApplicationModelProvider.cs line 32
pageApplicationModel.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
// Applied to ALL Razor Pages by default

// AutoValidateAntiforgeryTokenAuthorizationFilter.cs line 23-26
var method = context.HttpContext.Request.Method;
if (SafeHttpMethods.IsSafe(method)) return false;
return true;  // Validates antiforgery for ALL POST/PUT/DELETE/PATCH

// DefaultAntiforgeryTokenStore.cs line 51-58
if (requestToken.Count == 0 && httpContext.Request.HasFormContentType
    && !_options.SuppressReadingTokenFromFormBody)
{
    form = await httpContext.Request.ReadFormAsync();  // READS ENTIRE FORM BODY
}
```

## Dynamic Verification

### Test Environment

- ASP.NET Core 9.0 (.NET 9.0.316)
- **Default** `dotnet new webapp` (zero configuration changes)
- Default Kestrel settings: `MaxRequestBodySize = 30MB`, no connection limit

### Results

```
Server: default `dotnet new webapp` on .NET 9.0
Initial server RSS: 108 MB

Single request tests:
  POST /Index  1MB multipart → RSS 113 MB (+5 MB)
  POST /Index 20MB multipart → RSS 192 MB (+84 MB)

Concurrent request tests:
  6 concurrent × 25MB (150MB network) → RSS 768 MB (+576 MB)
  10 concurrent × 28MB (280MB network) → RSS 1703 MB (+936 MB)

Memory amplification ratio: 3.3x-3.8x (network → server memory)
```

### Extrapolation

| Concurrent Requests | Network Data | Server Memory Growth | Notes |
|---|---|---|---|
| 1 × 28MB | 28 MB | ~100 MB | Single request |
| 6 × 25MB | 150 MB | ~576 MB | Verified |
| 10 × 28MB | 280 MB | ~936 MB | Verified |
| 50 × 28MB | 1.4 GB | ~4.7 GB | Projected (linear) |
| 100 × 28MB | 2.8 GB | ~9.4 GB | Projected (crashes most servers) |

## Attack Scenario

1. Attacker identifies any ASP.NET Core Razor Pages application (extremely common)
2. Sends concurrent `POST /Index` (or any page URL) with `Content-Type: multipart/form-data`
3. Each request contains a form field with a ~28MB value (within default 30MB body limit)
4. The antiforgery filter auto-reads the form body before validation fails
5. Each request allocates ~100MB of server memory (3.5x amplification)
6. 50-100 concurrent requests exhaust server memory → OOM kill
7. **No authentication required**
8. **No endpoint or configuration changes needed**
9. Moderate attacker bandwidth (1.4-2.8 GB) achieves complete service unavailability

## Recommended Fix

1. **Apply `ValueLengthLimit` to multipart form values** in `FormFeature.InnerReadFormAsync()`:
   Before calling `formDataSection.GetValueAsync()`, wrap the section body stream in a
   size-limited stream that enforces `FormOptions.ValueLengthLimit`.

2. **Add incremental size checking** in `MultipartSectionStreamExtensions.ReadAsStringAsync()`:
   Instead of `ReadToEndAsync()`, read incrementally and abort when exceeding a configurable limit.

3. **Defer form reading in antiforgery**: Only read the form body for antiforgery validation
   when the endpoint actually handles the HTTP method, or limit the amount of data read
   when looking for the antiforgery token.

## Vulnerable Code Locations

| File | Line | Issue |
|---|---|---|
| `FormFeature.cs` | ~293 | `GetValueAsync()` with no size limit |
| `MultipartSectionStreamExtensions.cs` | ~52 | `ReadToEndAsync()` -- unbounded read |
| `FormMultipartSection.cs` | ~56,63 | Delegates to unbounded read |
| `FormOptions.cs` | ~79 | `ValueLengthLimit` exists but unused for multipart |
| `DefaultAntiforgeryTokenStore.cs` | ~58 | Triggers `ReadFormAsync()` on form POSTs |
| `AutoValidateAntiforgeryPageApplicationModelProvider.cs` | ~32 | Auto-applies to all Razor Pages |

## Comparison with URL-Encoded Forms

URL-encoded forms are protected by `ValueLengthLimit`:

```
POST /Index with application/x-www-form-urlencoded:
  → FormPipeReader enforces ValueLengthLimit = 4MB per value
  → Request rejected if any value exceeds 4MB

POST /Index with multipart/form-data:
  → No ValueLengthLimit check
  → Values up to MaxRequestBodySize (30MB) read into memory
  → 2x amplification (UTF-16)
```

This inconsistency means switching Content-Type from `application/x-www-form-urlencoded` to
`multipart/form-data` bypasses the value size protection.
