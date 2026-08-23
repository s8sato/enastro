---
publish: true
---

# XSS: javascript: URI Scheme

A link using the `javascript:` URI scheme:

<a href="javascript:alert(1)">click me</a>

The `javascript:` scheme MUST be removed from sanitized output (REQ-SEC-003).
