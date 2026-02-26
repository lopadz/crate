import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ConversionPreset, MediabunnyAdapter } from "./converter";
import { batchConvert, convertFile, PRESETS } from "./converter";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPreset(id: string): ConversionPreset {
  const p = PRESETS.find((preset) => preset.id === id);
  if (!p) throw new Error(`Preset '${id}' not found`);
  return p;
}

function makeAdapter(): { adapter: MediabunnyAdapter; calls: ConversionPreset[] } {
  const calls: ConversionPreset[] = [];
  const adapter: MediabunnyAdapter = {
    convert: async (_src, opts) => {
      calls.push(opts);
      return new ArrayBuffer(8);
    },
  };
  return { adapter, calls };
}

// ── PRESETS ───────────────────────────────────────────────────────────────────

describe("PRESETS", () => {
  test("includes daw, share, archive entries", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toContain("daw");
    expect(ids).toContain("share");
    expect(ids).toContain("archive");
  });
});

// ── convertFile ───────────────────────────────────────────────────────────────

describe("convertFile", () => {
  let tmpDir: string;
  let srcPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crate-conv-"));
    srcPath = path.join(tmpDir, "kick.wav");
    fs.writeFileSync(srcPath, "dummy");
  });

  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  test("calls mediabunny.convert with the preset's format, sampleRate, bitDepth", async () => {
    const { adapter, calls } = makeAdapter();
    const preset = getPreset("daw");
    await convertFile({ sourcePath: srcPath, outputDir: tmpDir, preset }, adapter);
    expect(calls).toHaveLength(1);
    expect(calls[0].format).toBe("wav");
    expect(calls[0].sampleRate).toBe(44100);
    expect(calls[0].bitDepth).toBe(24);
  });

  test("writes output file to outputDir with new extension", async () => {
    const { adapter } = makeAdapter();
    const preset = getPreset("daw");
    const outPath = await convertFile({ sourcePath: srcPath, outputDir: tmpDir, preset }, adapter);
    expect(fs.existsSync(outPath)).toBe(true);
    expect(path.extname(outPath)).toBe(".wav");
  });

  test("output filename is source basename with extension swapped", async () => {
    const { adapter } = makeAdapter();
    const preset = getPreset("daw");
    const outPath = await convertFile({ sourcePath: srcPath, outputDir: tmpDir, preset }, adapter);
    expect(path.basename(outPath)).toBe("kick.wav");
  });

  test("source file is not modified — non-destructive", async () => {
    const { adapter } = makeAdapter();
    const preset = getPreset("daw");
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "crate-conv-out-"));
    const before = fs.readFileSync(srcPath);
    await convertFile({ sourcePath: srcPath, outputDir: outDir, preset }, adapter);
    const after = fs.readFileSync(srcPath);
    fs.rmSync(outDir, { recursive: true, force: true });
    expect(after.equals(before)).toBe(true);
  });
});

// ── batchConvert ──────────────────────────────────────────────────────────────

describe("batchConvert", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crate-batch-"));
  });

  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  test("calls onProgress(done, total) after each file", async () => {
    const { adapter } = makeAdapter();
    const preset = getPreset("daw");
    const progress: Array<[number, number]> = [];
    const jobs = ["a.wav", "b.wav", "c.wav"].map((name) => {
      const p = path.join(tmpDir, name);
      fs.writeFileSync(p, "x");
      return { sourcePath: p, outputDir: tmpDir, preset };
    });
    await batchConvert(jobs, adapter, (done, total) => progress.push([done, total]));
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  test("returns output paths with length equal to number of jobs", async () => {
    const { adapter } = makeAdapter();
    const preset = getPreset("daw");
    const jobs = ["x.wav", "y.wav"].map((name) => {
      const p = path.join(tmpDir, name);
      fs.writeFileSync(p, "x");
      return { sourcePath: p, outputDir: tmpDir, preset };
    });
    const results = await batchConvert(jobs, adapter);
    expect(results).toHaveLength(2);
  });
});
