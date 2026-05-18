import { describe, expect, it } from "vitest";

import { formatDuration, formatTimestamp, newId } from "../js/utils.js";

describe("newId", () => {
  it("returns a non-empty string", () => {
    expect(newId()).toEqual(expect.any(String));
    expect(newId().length).toBeGreaterThan(0);
  });

  it("returns unique values across repeated calls", () => {
    const ids = new Set(Array.from({ length: 25 }, () => newId()));

    expect(ids.size).toBe(25);
  });
});

describe("formatTimestamp", () => {
  it("formats a millisecond timestamp for display", () => {
    expect(formatTimestamp(Date.UTC(2026, 4, 18, 19, 24))).toEqual(expect.any(String));
  });

  it("rejects invalid timestamps", () => {
    expect(() => formatTimestamp(Number.NaN)).toThrow(TypeError);
  });
});

describe("formatDuration", () => {
  it("formats sub-hour durations as minutes and seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65.9)).toBe("1:05");
  });

  it("formats hour-long durations with an hour segment", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("rejects negative durations", () => {
    expect(() => formatDuration(-1)).toThrow(RangeError);
  });
});
