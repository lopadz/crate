import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createQueryHelpers, initSchema } from "./db";
import type { MediabunnyNormalizer, NormalizeJob } from "./loudnessNormalizer";
import { batchNormalize, normalizeFile } from "./loudnessNormalizer";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDb() {
  const db = new Database(":memory:");
  initSchema(db);
  return createQueryHelpers(db);
}

function makeMediabunny(): MediabunnyNormalizer {
  return { normalize: async () => new ArrayBuffer(8) };
}

// ── batchNormalize ────────────────────────────────────────────────────────────

describe("batchNormalize", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crate-batch-norm-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("calls onProgress for each job in a two-job batch", async () => {
    const src1 = path.join(tmpDir, "a.wav");
    const src2 = path.join(tmpDir, "b.wav");
    fs.writeFileSync(src1, "x");
    fs.writeFileSync(src2, "y");
    const progress: [number, number][] = [];
    const jobs: NormalizeJob[] = [
      { sourcePath: src1, targetLufs: -14, overwrite: true },
      { sourcePath: src2, targetLufs: -14, overwrite: true },
    ];
    await batchNormalize(jobs, makeMediabunny(), makeDb(), (done, total) =>
      progress.push([done, total]),
    );
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  test("returns OperationRecord with operation 'normalize'", async () => {
    const src = path.join(tmpDir, "a.wav");
    fs.writeFileSync(src, "x");
    const jobs: NormalizeJob[] = [{ sourcePath: src, targetLufs: -14, overwrite: true }];
    const record = await batchNormalize(jobs, makeMediabunny(), makeDb());
    expect(record.operation).toBe("normalize");
    expect(record.id).toBeGreaterThan(0);
  });
});

// ── normalizeFile ─────────────────────────────────────────────────────────────

describe("normalizeFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crate-norm-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("calls mediabunny.normalize with correct sourcePath and targetLufs", async () => {
    const src = path.join(tmpDir, "snare.wav");
    fs.writeFileSync(src, "x");
    let capturedSrc = "";
    let capturedLufs = 0;
    const mediabunny: MediabunnyNormalizer = {
      normalize: async (s, l) => {
        capturedSrc = s;
        capturedLufs = l;
        return new ArrayBuffer(8);
      },
    };
    const job: NormalizeJob = { sourcePath: src, targetLufs: -23, overwrite: true };
    await normalizeFile(job, mediabunny);
    expect(capturedSrc).toBe(src);
    expect(capturedLufs).toBe(-23);
  });

  test("overwrite: true — overwrites the source file", async () => {
    const src = path.join(tmpDir, "kick.wav");
    fs.writeFileSync(src, "original");
    const job: NormalizeJob = { sourcePath: src, targetLufs: -14, overwrite: true };
    const outPath = await normalizeFile(job, makeMediabunny());
    expect(outPath).toBe(src);
    // file exists and has been replaced by the 8-byte ArrayBuffer
    expect(fs.statSync(src).size).toBe(8);
  });

  test("overwrite: false — creates new file, source untouched", async () => {
    const src = path.join(tmpDir, "kick.wav");
    fs.writeFileSync(src, "original");
    const outDir = path.join(tmpDir, "out");
    const job: NormalizeJob = {
      sourcePath: src,
      targetLufs: -14,
      overwrite: false,
      outputDir: outDir,
    };
    const outPath = await normalizeFile(job, makeMediabunny());
    expect(fs.existsSync(src)).toBe(true);
    expect(fs.readFileSync(src, "utf8")).toBe("original");
    expect(fs.existsSync(outPath)).toBe(true);
  });
});
