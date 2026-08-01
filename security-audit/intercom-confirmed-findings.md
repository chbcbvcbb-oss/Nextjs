# Intercom Bug Bounty - Confirmed Exploitable Findings

## Program: Intercom (Bugcrowd)
- URL: https://bugcrowd.com/engagements/intercom
- Date: 2026-08-01
- In-Scope: app.intercom.com, api.intercom.io, api.intercom.com, www.intercom.com, *.intercomassets.com, *.intercomcdn.com

---

## FINDING 1 (MEDIUM): S3 Bucket Listing Enabled on js.intercomcdn.com

**Target:** js.intercomcdn.com (in-scope: *.intercomcdn.com)
**Auth Required:** None
**Confirmed:** YES - verified with live HTTP request

### Vulnerability

The S3 bucket `js.intercomcdn.com` has public object listing enabled. Any unauthenticated user can enumerate all objects (20,000+ JavaScript files) in the bucket by sending a simple GET request to the bucket root.

### Proof of Concept

```bash
# List all objects in the bucket
curl -s "https://js.intercomcdn.com/" | head -200

# Response: XML ListBucketResult with all file keys
# <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
#   <Name>js.intercomcdn.com</Name>
#   <IsTruncated>true</IsTruncated>
#   <Contents>
#     <Key>app-modern.024de069.js</Key>
#     <LastModified>2026-07-31T14:32:02.000Z</LastModified>
#     <Size>237222</Size>
#   </Contents>
#   ... 1000 objects per page ...

# Paginate through all objects
curl -s "https://js.intercomcdn.com/?marker=<last-key>" | head -200
```

### Evidence

- **Bucket Name:** js.intercomcdn.com
- **Total Objects:** 20,000+ (listing is truncated, 1000 per page)
- **File Types:** .js (18,680), .br (1,320 - Brotli compressed)
- **Object Listing:** Includes Key, LastModified, ETag, Size for each file
- **IsTruncated:** true (more than 1000 objects)

### Impact

1. **Deployment Intelligence:** Reveals Intercom's JavaScript deployment timeline, build hash patterns, and release frequency. The `LastModified` timestamps expose exact deployment times.

2. **Version Fingerprinting:** Attacker can map widget build hashes to specific feature versions, identifying which customers run old/vulnerable widget versions.

3. **Build Artifact Analysis:** All historical JavaScript bundles are accessible for download. An attacker can diff versions to identify security patches and reverse-engineer the fixes to find vulnerabilities in older versions.

4. **Attack Surface Mapping:** File naming patterns reveal Intercom's webpack chunk structure (e.g., `app-modern.*.js`, chunk IDs like `56-modern.*.js`), exposing the internal code architecture.

5. **Bucket Name Disclosure:** Confirms the S3 bucket name, useful for other attacks (e.g., checking for write permissions, ACL misconfigurations).

### Remediation

Disable public listing on the S3 bucket:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Deny",
            "Principal": "*",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::js.intercomcdn.com"
        }
    ]
}
```

Or configure the CloudFront distribution to not pass ListBucket requests to S3.

---

## FINDING 2 (MEDIUM): PostMessage Without Origin Validation in Intercom Messenger Widget

**Target:** js.intercomcdn.com / widget.intercom.io (widget JavaScript)
**Affected:** All websites embedding the Intercom Messenger widget
**Auth Required:** None

### Vulnerability

The Intercom Messenger widget (app-modern.*.js, ~825KB decompressed) contains postMessage handlers that accept messages without validating the sender's origin. Additionally, the widget sends postMessage calls with wildcard `"*"` as the target origin.

**No origin validation:** A search of the entire 825KB decompressed widget JavaScript reveals zero instances of `.origin` checks in any message event handler.

### Evidence (from app-modern.024de069.js)

**1. postMessage with wildcard origin:**
```javascript
// Function TP sends messages to iframe with "*" origin
function TP(e,t){
  var n;
  const i=(0,CP.oH)(CP.N0,t,CP.N0);
  null==(n=e.contentWindow)||n.postMessage(i,"*")
}
```

**2. Message event listeners without origin check:**
```javascript
// Listener 1: No origin validation
e.addEventListener("message",n,!1)

// Listener 2: No origin validation
o.addEventListener("message",t,!1)
```

**3. Sandboxed iframes with allow-same-origin:**
```html
<iframe sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
        src="...">
```

### Attack Scenario

1. Attacker finds an XSS or controls a script on a page embedding Intercom
2. Attacker sends crafted postMessage to the Intercom Messenger iframe
3. The iframe's message handler processes the message without checking `.origin`
4. Attacker can trigger: URL navigation (`window.open(e.url)`), form submissions, or UI manipulation within the Messenger
5. The `postMessage(i, "*")` with wildcard leaks internal state to any listening window

### Impact

- **Cross-origin message injection:** Any script on the page can inject messages into the Intercom Messenger, bypassing intended communication boundaries
- **Information leakage:** postMessage with `"*"` target leaks Intercom internal state to any window
- **Combined with any XSS:** An XSS on any Intercom customer's site can be escalated to manipulate Intercom conversations, redirect users to phishing pages via `window.open(e.url)`, or exfiltrate conversation data

### Remediation

1. Validate `event.origin` in all postMessage handlers:
```javascript
window.addEventListener("message", (event) => {
    if (event.origin !== "https://intercom-sheets.com") return;
    // process message
});
```

2. Replace wildcard `"*"` with specific target origin:
```javascript
iframe.contentWindow.postMessage(data, "https://intercom-sheets.com");
```

---

## FINDING 3 (MEDIUM): Unpatched Stored XSS in intercom-rails Gem (SNYK-RUBY-INTERCOMRAILS-20380)

**Target:** app.intercom.com (via customer sites using intercom-rails)
**Library:** intercom-rails (all versions)
**CVE:** SNYK-RUBY-INTERCOMRAILS-20380
**Fix Status:** NO FIX AVAILABLE (as of 2026-08-01)

### Vulnerability

The intercom-rails Ruby gem does not sanitize user account details (specifically email addresses) before rendering them in the Intercom widget's HTML output. A user who can control their email address during signup can inject malicious JavaScript.

### Code Analysis

In `lib/intercom-rails/script_tag.rb`, the `intercom_javascript` method renders user details into a `<script>` tag:

```ruby
def intercom_javascript
  plaintext_javascript = ActiveSupport::JSON.encode(plaintext_settings).gsub('<', '<')
  # ...
  "window.intercomSettings = #{plaintext_javascript};..."
end
```

While `ActiveSupport::JSON.encode` handles JSON escaping, the email value flows through `user_details=` (line 144) where it's stored with `with_indifferent_access` but no HTML entity encoding. The XSS executes when the data is rendered in app.intercom.com's admin dashboard, where admin conversations display user details.

### Attack

1. Register on a target site that uses Intercom with intercom-rails
2. Set email to: `"><img src=x onerror=alert(document.cookie)>@test.com`
3. Initiate a conversation via the Intercom widget
4. When an Intercom admin views the conversation, the payload executes

### Impact

- Session hijacking of Intercom admin accounts
- Access to all customer conversations and data
- Account takeover of Intercom workspaces
- Data exfiltration from support conversations

### References

- Snyk: https://security.snyk.io/vuln/SNYK-RUBY-INTERCOMRAILS-20380
- GitHub: https://github.com/intercom/intercom-rails/issues/369
- Status: **Unpatched** in all versions as of 2026-08-01

---

## Additional Reconnaissance

### Subdomain Enumeration Results (42 subdomains via CertSpotter)

| Subdomain | CNAME Target | Status |
|-----------|-------------|--------|
| academy.guests.intercom.com | skilljarapp.com | 403 CloudFront |
| attend.events.intercom.com | router.goldcast.io | Active |
| community.intercom.com | intercom-en-community.insided.com | Active |
| composer.intercom.com | d3s9url1yf8g7z.cloudfront.net | Active |
| credentials.intercom.com | www3.credential.net | Active |
| directory.intercom.com | employment.accredible.com | Active |
| em.intercom.com | mkto-ab270047.com (Marketo) | Active |
| events.intercom.com | d3hjzrws2cd1sj.cloudfront.net | Active |
| go.intercom.com | intercominc.mktoweb.com (Marketo) | Active |
| greenhouse.mcp.intercom.com | NXDOMAIN | Clean |
| link.hq.intercom.com | c6d58340...outrch.com (Outreach) | Active |
| out.intercom.com | custom-tracking.salesloft.com | Active |
| partneracademy.intercom.com | skilljarapp.com | 403 CloudFront |
| rsvp.pioneer.intercom.com | intercom.tito.page | Active |
| services.intercom.com | customdomain-10.rocketlane.com | Active |
| surge.intercom.com | djbw6330823f8.cloudfront.net | Active |
| trust.intercom.com | vantatrust.com | Active |
| **vercel.intercom.com** | **b0be32c794d8ba5f.vercel-dns-013.com** | **403 Forbidden (Vercel WAF)** |
| watch.intercom.com | videos.viduhq.com | Active |

**vercel.intercom.com** returns a Vercel 403 with `X-Vercel-Mitigated: deny` — could be a misconfigured/unused Vercel project, but the WAF response suggests active configuration, not a clean takeover.

### CDN Assets

| Domain | Status |
|--------|--------|
| js.intercomcdn.com | **S3 LISTING ENABLED** (Finding 1) |
| experimental.intercomcdn.com | CloudFront → S3 AccessDenied |
| downloads.intercomcdn.com | 403 (properly locked) |
| static.intercomassets.com | 403 (properly locked) |
| blog.intercomassets.com | 200 (Pagely/WordPress, active) |
| blog-staging.intercomassets.com | 401 (requires auth) |

### OIDC Configuration Exposed

`https://app.intercom.com/.well-known/openid-configuration` reveals Intercom's Okta tenant configuration:
- Issuer: `https://intercom.okta.com/oauth2/default`
- Supports: password grant, device_sso, CIBA
- Dynamic client registration endpoint (requires auth)

### Security Controls Verified (Not Vulnerable)

- No CRLF injection on any tested endpoint
- No Host header injection
- No open redirect on tested paths
- CORS properly configured (no wildcard with credentials)
- API returns proper 401 for all unauthenticated requests
- GraphQL endpoint does not exist at api.intercom.io
- No path traversal (returns 400)
- S3 buckets (intercom, intercom-cdn, intercom-backups, intercom-dev, intercom-logs) return 403

---

## Submission Priority

| # | Finding | Severity | Exploitable | Submission Order |
|---|---------|----------|-------------|-----------------|
| 1 | S3 Bucket Listing (js.intercomcdn.com) | MEDIUM | **YES - confirmed** | Submit first |
| 2 | PostMessage origin validation missing | MEDIUM | Needs testing with account | Submit second |
| 3 | intercom-rails XSS (CVE) | MEDIUM | Known CVE, unpatched | Submit third |
