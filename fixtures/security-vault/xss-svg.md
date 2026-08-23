---
publish: true
---

# XSS: SVG onload

An inline SVG with an `onload` handler, a pattern some sanitizers miss:

<svg onload="alert(1)"></svg>

The entire `<svg>` element MUST NOT survive sanitization (REQ-SEC-003), since
`svg` is not in the tag allowlist.
