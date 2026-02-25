import { describe, expect, test } from "bun:test";
import { resolveTokens } from "./tokenRenamer";

describe("resolveTokens", () => {
  // ── Basic token resolution ──────────────────────────────────────────────────

  test("{original} alone returns the base name unchanged", () => {
    expect(resolveTokens("{original}", { original: "kick" })).toBe("kick");
  });

  test("{bpm}_{key}_{original} resolves all three tokens", () => {
    expect(resolveTokens("{bpm}_{key}_{original}", { original: "kick", bpm: 128, key: "Am" })).toBe(
      "128_Am_kick",
    );
  });

  test("unknown token is left as literal text", () => {
    expect(resolveTokens("{unknown}_{original}", { original: "kick" })).toBe("{unknown}_kick");
  });

  test("pattern with no tokens returns the pattern unchanged", () => {
    expect(resolveTokens("my-loop", { original: "kick" })).toBe("my-loop");
  });

  // ── bpm ────────────────────────────────────────────────────────────────────

  test("missing bpm leaves {bpm} as-is", () => {
    expect(resolveTokens("{bpm}_{original}", { original: "kick" })).toBe("{bpm}_kick");
  });

  test("null bpm leaves {bpm} as-is", () => {
    expect(resolveTokens("{bpm}_{original}", { original: "kick", bpm: null })).toBe("{bpm}_kick");
  });

  test("bpm of 120.7 rounds to '121'", () => {
    expect(resolveTokens("{bpm}", { original: "x", bpm: 120.7 })).toBe("121");
  });

  // ── key / key_camelot ──────────────────────────────────────────────────────

  test("{key_camelot} resolves to Camelot notation", () => {
    expect(resolveTokens("{key_camelot}_{original}", { original: "loop", keyCamelot: "8A" })).toBe(
      "8A_loop",
    );
  });

  // ── lufs ───────────────────────────────────────────────────────────────────

  test("{lufs} of -14.26 formats as '-14.3' (one decimal, rounded)", () => {
    expect(resolveTokens("{lufs}", { original: "x", lufs: -14.26 })).toBe("-14.3");
  });

  // ── duration ───────────────────────────────────────────────────────────────

  test("{duration} of 3.16 formats as '3.2s' (one decimal)", () => {
    expect(resolveTokens("{duration}", { original: "x", duration: 3.16 })).toBe("3.2s");
  });

  // ── format ─────────────────────────────────────────────────────────────────

  test("{format} returns lowercase value", () => {
    expect(resolveTokens("{format}", { original: "x", format: "WAV" })).toBe("wav");
    expect(resolveTokens("{format}", { original: "x", format: "flac" })).toBe("flac");
  });

  // ── index ──────────────────────────────────────────────────────────────────

  test("{index} 0 → '001', 9 → '010', 99 → '100' (1-based, 3 digits)", () => {
    expect(resolveTokens("{index}", { original: "x", index: 0 })).toBe("001");
    expect(resolveTokens("{index}", { original: "x", index: 9 })).toBe("010");
    expect(resolveTokens("{index}", { original: "x", index: 99 })).toBe("100");
  });

  // ── date ───────────────────────────────────────────────────────────────────

  test("{date} uses the provided date string", () => {
    expect(resolveTokens("{date}", { original: "x", date: "2026-02-25" })).toBe("2026-02-25");
  });

  test("{date} with no date defaults to today in YYYY-MM-DD format", () => {
    const result = resolveTokens("{date}", { original: "x" });
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // ── collection ─────────────────────────────────────────────────────────────

  test("{collection} resolves when provided", () => {
    expect(resolveTokens("{collection}", { original: "x", collection: "Drums" })).toBe("Drums");
  });

  test("{collection} null leaves token as-is", () => {
    expect(resolveTokens("{collection}", { original: "x", collection: null })).toBe("{collection}");
  });
});
