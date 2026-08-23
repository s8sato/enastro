import sanitizeHtmlLib from "sanitize-html";
import { SANITIZE_OPTIONS } from "./config.js";

/**
 * Sanitizes raw HTML/script that may be embedded in a note body before it
 * is included in any public artifact (REQ-SEC-003). Uses an explicit
 * allowlist (see {@link SANITIZE_OPTIONS}) rather than a denylist, per
 * spec/08-security-and-privacy.md §3.
 */
export function sanitizeHtml(raw: string): string {
  return sanitizeHtmlLib(raw, SANITIZE_OPTIONS);
}
