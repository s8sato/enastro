---
publish: true
aliases: [note-b]
---

# Note C Alias

This note declares an alias (`note-b`) that collides with the title of
[[note-b]]. This fixture exercises REQ-CONTENT-006 (alias vs. title
resolution priority): title matches take priority over alias matches, so
`[[note-b]]` always resolves to `note-b.md`, never to this note.
