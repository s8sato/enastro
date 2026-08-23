import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument } from "../parser/index.js";
import { sanitizeHtml } from "./sanitize.js";

const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "fixtures",
  "security-vault",
);

function sanitizedBodyOf(noteFileName: string): string {
  const raw = readFileSync(path.join(FIXTURE_DIR, noteFileName), "utf-8");
  const { body } = parseDocument(raw);
  return sanitizeHtml(body);
}

describe("sanitizeHtml against fixtures/security-vault", () => {
  it("removes <script> tags entirely (xss-script-tag.md)", () => {
    const sanitized = sanitizedBodyOf("xss-script-tag.md");
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("alert(1)</script>");
    // Markdown syntax (not yet rendered to HTML) passes through untouched.
    expect(sanitized).toContain("**bold**");
  });

  it("strips onerror event handler attributes (xss-event-handler.md)", () => {
    const sanitized = sanitizedBodyOf("xss-event-handler.md");
    // The word "onerror" legitimately appears in the fixture's prose
    // (describing the attack); what MUST be gone is the live attribute.
    expect(sanitized).not.toMatch(/onerror\s*=/i);
    expect(sanitized).not.toContain("alert(1)");
  });

  it("strips javascript: URI schemes from links (xss-javascript-uri.md)", () => {
    const sanitized = sanitizedBodyOf("xss-javascript-uri.md");
    // The scheme name legitimately appears in the fixture's prose; what MUST
    // be gone is the live href pointing at it.
    expect(sanitized).not.toMatch(/href\s*=\s*"javascript:/i);
  });

  it("removes <svg> elements entirely, including onload handlers (xss-svg.md)", () => {
    const sanitized = sanitizedBodyOf("xss-svg.md");
    expect(sanitized).not.toContain("<svg");
    expect(sanitized).not.toMatch(/onload\s*=/i);
    expect(sanitized).not.toContain("alert(1)");
  });

  it("preserves allowlisted formatting tags and http(s) links", () => {
    const sanitized = sanitizeHtml(
      '<p>See <a href="https://example.com">this link</a> and <strong>bold</strong> text.</p>',
    );
    expect(sanitized).toContain('<a href="https://example.com">this link</a>');
    expect(sanitized).toContain("<strong>bold</strong>");
  });

  it("strips disallowed tags like <iframe> while keeping surrounding text", () => {
    const sanitized = sanitizeHtml("<p>before</p><iframe src=\"https://evil.example\"></iframe><p>after</p>");
    expect(sanitized).not.toContain("<iframe");
    expect(sanitized).toContain("before");
    expect(sanitized).toContain("after");
  });
});
