import { describe, expect, it } from "vitest";
import { formatTimestamp } from "./format-timestamp.js";

describe("formatTimestamp (REQ-UX-007)", () => {
  it("formats an epoch-ms timestamp as 'YYYY-MM-DD HH:MM UTC'", () => {
    // 2026-08-23T12:34:56.000Z
    expect(formatTimestamp(Date.UTC(2026, 7, 23, 12, 34, 56))).toBe("2026-08-23 12:34 UTC");
  });

  it("zero-pads single-digit month/day/hour/minute", () => {
    // 2026-01-02T03:04:00.000Z
    expect(formatTimestamp(Date.UTC(2026, 0, 2, 3, 4, 0))).toBe("2026-01-02 03:04 UTC");
  });

  it("is independent of the process's local timezone (always renders in UTC)", () => {
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = "America/Los_Angeles";
      expect(formatTimestamp(Date.UTC(2026, 7, 23, 12, 34, 56))).toBe("2026-08-23 12:34 UTC");
    } finally {
      process.env.TZ = originalTz;
    }
  });
});
