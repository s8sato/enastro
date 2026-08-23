import { describe, expect, it } from "vitest";
import { formatLocalTimestamp } from "./format-local-time.mjs";

describe("formatLocalTimestamp (REQ-UX-007)", () => {
  it("formats with a zero offset (UTC) the same as the fixed-UTC formatter, plus an explicit offset suffix", () => {
    // 2026-08-23T12:34:56.000Z
    expect(formatLocalTimestamp(Date.UTC(2026, 7, 23, 12, 34, 56), 0)).toBe(
      "2026-08-23 12:34 (UTC+00:00)",
    );
  });

  it("shifts forward for a positive offset (e.g. JST, UTC+9)", () => {
    // 2026-08-23T12:34:56.000Z -> 2026-08-23 21:34 JST
    expect(formatLocalTimestamp(Date.UTC(2026, 7, 23, 12, 34, 56), 540)).toBe(
      "2026-08-23 21:34 (UTC+09:00)",
    );
  });

  it("shifts backward for a negative offset (e.g. US Eastern, UTC-5)", () => {
    // 2026-08-23T12:34:56.000Z -> 2026-08-23 07:34 EST
    expect(formatLocalTimestamp(Date.UTC(2026, 7, 23, 12, 34, 56), -300)).toBe(
      "2026-08-23 07:34 (UTC-05:00)",
    );
  });

  it("supports half-hour offsets (e.g. India, UTC+5:30)", () => {
    // 2026-08-23T12:34:56.000Z -> 2026-08-23 18:04 IST
    expect(formatLocalTimestamp(Date.UTC(2026, 7, 23, 12, 34, 56), 330)).toBe(
      "2026-08-23 18:04 (UTC+05:30)",
    );
  });

  it("rolls over to the next/previous day when the offset crosses midnight", () => {
    // 2026-08-23T23:00:00.000Z -> 2026-08-24 08:00 JST
    expect(formatLocalTimestamp(Date.UTC(2026, 7, 23, 23, 0, 0), 540)).toBe(
      "2026-08-24 08:00 (UTC+09:00)",
    );
  });

  it("zero-pads single-digit month/day/hour/minute", () => {
    // 2026-01-02T03:04:00.000Z
    expect(formatLocalTimestamp(Date.UTC(2026, 0, 2, 3, 4, 0), 0)).toBe(
      "2026-01-02 03:04 (UTC+00:00)",
    );
  });
});
