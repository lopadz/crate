import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { MediabunnyTrimmer, TrimJob } from "./silenceTrimmer";
import { trimSilence } from "./silenceTrimmer";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMediabunny(): MediabunnyTrimmer {
  return { trim: async () => new ArrayBuffer(8) };
}

// ── trimSilence ───────────────────────────────────────────────────────────────

describe("trimSilence", () => {
  let tmpDir: string;
  let outDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crate-trim-"));
    outDir = path.join(tmpDir, "out");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("output filename matches source filename", async () => {
    const src = path.join(tmpDir, "snare.wav");
    fs.writeFileSync(src, "x");
    const job: TrimJob = { sourcePath: src, thresholdDb: -60, outputDir: outDir };
    const outPath = await trimSilence(job, makeMediabunny());
    expect(path.basename(outPath)).toBe("snare.wav");
  });

  test("output is placed in outputDir, source untouched", async () => {
    const src = path.join(tmpDir, "hi-hat.wav");
    fs.writeFileSync(src, "original");
    const job: TrimJob = { sourcePath: src, thresholdDb: -60, outputDir: outDir };
    const outPath = await trimSilence(job, makeMediabunny());
    expect(fs.existsSync(src)).toBe(true);
    expect(fs.readFileSync(src, "utf8")).toBe("original");
    expect(outPath.startsWith(outDir)).toBe(true);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  test("calls mediabunny.trim with correct path and thresholdDb", async () => {
    const src = path.join(tmpDir, "kick.wav");
    fs.writeFileSync(src, "x");
    let capturedSrc = "";
    let capturedDb = 0;
    const mediabunny: MediabunnyTrimmer = {
      trim: async (s, d) => {
        capturedSrc = s;
        capturedDb = d;
        return new ArrayBuffer(8);
      },
    };
    const job: TrimJob = { sourcePath: src, thresholdDb: -60, outputDir: outDir };
    await trimSilence(job, mediabunny);
    expect(capturedSrc).toBe(src);
    expect(capturedDb).toBe(-60);
  });
});
