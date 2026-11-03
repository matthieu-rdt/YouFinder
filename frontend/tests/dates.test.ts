import {describe, expect, it} from "vitest";
import {nextUtcDayStart} from "../src/lib/youtube";

describe("Fin de jour UTC exclusive", () => {
  it.each([
    ["2026-07-07", "2026-07-08T00:00:00Z"],
    ["2026-06-30", "2026-07-01T00:00:00Z"],
    ["2026-12-31", "2027-01-01T00:00:00Z"],
    ["2028-02-29", "2028-03-01T00:00:00Z"],
    ["2026-03-29", "2026-03-30T00:00:00Z"],
    ["2026-10-25", "2026-10-26T00:00:00Z"],
  ])("convertit %s en %s indépendamment du fuseau local", (day, expected) => {
    expect(nextUtcDayStart(day)).toBe(expected);
  });
  it.each(["bad", "2026-02-30", "9999-12-31"])("rejette %s", day => {
    expect(() => nextUtcDayStart(day)).toThrow();
  });
});
