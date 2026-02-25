import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createDragCopy, resolvePattern } from "./dragDrop";

// ── resolvePattern ────────────────────────────────────────────────────────────

describe("resolvePattern", () => {
  test("{bpm}_{key}_{original} resolves all known tokens", () => {
    expect(
      resolvePattern("{bpm}_{key}_{original}", {
        original: "kick",
        bpm: 128,
        key: "Am",
        keyCamelot: "8A",
      }),
    ).toBe("128_Am_kick");
  });

  test("{key_camelot} resolves to Camelot notation", () => {
    expect(
      resolvePattern("{key_camelot}_{original}", {
        original: "loop",
        keyCamelot: "8A",
      }),
    ).toBe("8A_loop");
  });

  test("unknown tokens are left as literal text", () => {
    expect(resolvePattern("{unknown}_{original}", { original: "kick" })).toBe("{unknown}_kick");
  });

  test("{original} alone leaves the base name unchanged", () => {
    expect(resolvePattern("{original}", { original: "kick" })).toBe("kick");
  });

  test("missing bpm leaves {bpm} token as-is", () => {
    expect(resolvePattern("{bpm}_{original}", { original: "kick" })).toBe("{bpm}_kick");
  });

  test("null bpm leaves {bpm} token as-is", () => {
    expect(resolvePattern("{bpm}_{original}", { original: "kick", bpm: null })).toBe("{bpm}_kick");
  });

  test("bpm is rounded to nearest integer", () => {
    expect(resolvePattern("{bpm}", { original: "x", bpm: 120.7 })).toBe("121");
  });
});

// ── createDragCopy ────────────────────────────────────────────────────────────

describe("createDragCopy", () => {
  const createdPaths: string[] = [];

  afterEach(() => {
    // Clean up temp files created during tests
    for (const p of createdPaths) {
      try {
        fs.rmSync(path.dirname(p), { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    createdPaths.length = 0;
  });

  test("returns a path under /tmp/crate-drag/", async () => {
    const src = path.join(os.tmpdir(), "test-drag-src.wav");
    fs.writeFileSync(src, "fake-audio");

    const result = await createDragCopy({
      pattern: "{original}",
      filePath: src,
    });
    createdPaths.push(result);

    expect(result).toContain("/tmp/crate-drag/");
  });

  test("resolved filename uses the pattern and preserves extension", async () => {
    const src = path.join(os.tmpdir(), "kick.wav");
    fs.writeFileSync(src, "fake-audio");

    const result = await createDragCopy({
      pattern: "{bpm}_{key}_{original}",
      filePath: src,
      bpm: 128,
      key: "Am",
    });
    createdPaths.push(result);

    expect(path.basename(result)).toBe("128_Am_kick.wav");
  });

  test("{original} pattern preserves the original filename", async () => {
    const src = path.join(os.tmpdir(), "loop.wav");
    fs.writeFileSync(src, "fake-audio");

    const result = await createDragCopy({
      pattern: "{original}",
      filePath: src,
    });
    createdPaths.push(result);

    expect(path.basename(result)).toBe("loop.wav");
  });

  test("the copied file exists at the returned path", async () => {
    const src = path.join(os.tmpdir(), "snap.wav");
    fs.writeFileSync(src, "snap-content");

    const result = await createDragCopy({
      pattern: "{original}",
      filePath: src,
    });
    createdPaths.push(result);

    expect(fs.existsSync(result)).toBe(true);
    expect(fs.readFileSync(result, "utf8")).toBe("snap-content");
  });

  test("each call creates a unique directory (uuid-based)", async () => {
    const src = path.join(os.tmpdir(), "hi.wav");
    fs.writeFileSync(src, "x");

    const r1 = await createDragCopy({ pattern: "{original}", filePath: src });
    const r2 = await createDragCopy({ pattern: "{original}", filePath: src });
    createdPaths.push(r1, r2);

    expect(path.dirname(r1)).not.toBe(path.dirname(r2));
  });
});
