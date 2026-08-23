---
publish: true
---

# XSS: Event Handler Attribute

An image tag with an `onerror` event handler attribute:

<img src=x onerror="alert(1)">

The `onerror` attribute MUST be stripped from sanitized output (REQ-SEC-003).
