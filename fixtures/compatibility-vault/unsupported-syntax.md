---
publish: true
---

# Unsupported Syntax

This note exercises v0.1-unsupported Obsidian Flavored Markdown syntax
(REQ-CONTENT-005): none of the following patterns should cause the build to
fail, and none should be silently transformed or removed — they must pass
through as plain text/markdown.

A callout:

> [!note]
> This is a callout body.

A heading link and a block reference (both point at the same target note,
but neither should resolve to a real link since the fragment is not part of
v0.1's supported wikilink syntax):

- [[日本語のノート#heading]]
- [[日本語のノート#^blockid]]

A dataview query:

```dataview
LIST FROM #tag
```

A canvas-like JSON blob:

```json
{"nodes": [], "edges": []}
```
