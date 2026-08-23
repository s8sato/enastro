---
publish: true
---

# XSS: Script Tag

Some normal text with a **bold** word, followed by an embedded script tag:

<script>alert(1)</script>

The script tag MUST be removed entirely from sanitized output (REQ-SEC-003).
