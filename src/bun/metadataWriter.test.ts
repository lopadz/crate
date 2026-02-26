import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createQueryHelpers, initSchema } from "./db";
import { batchWriteMetadata, writeMetadataToFile } from "./metadataWriter";
import { writeUint32LE } from "./wavUtils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDb() {
  const db = new Database(":memory:");
  initSchema(db);
  return createQueryHelpers(db);
}

/** Minimal valid 52-byte WAV (RIFF + fmt + data). */
function makeMinimalWav(): Uint8Array {
  const enc = new TextEncoder();

  // fmt  chunk (16 bytes PCM descriptor)
  const fmt = new Uint8Array(16);
  fmt[0] = 1; // wFormatTag = 1 (PCM)
  fmt[2] = 1; // nChannels = 1
  writeUint32LE(fmt, 4, 44100); // nSamplesPerSec
  writeUint32LE(fmt, 8, 88200); // nAvgBytesPerSec
  fmt[12] = 2; // nBlockAlign
  fmt[14] = 16; // wBitsPerSample

  // data chunk (4 bytes of silence)
  const audio = new Uint8Array(4);

  const fmtChunk = new Uint8Array(8 + 16);
  fmtChunk.set(enc.encode("fmt "));
  writeUint32LE(fmtChunk, 4, 16);
  fmtChunk.set(fmt, 8);

  const dataChunk = new Uint8Array(8 + 4);
  dataChunk.set(enc.encode("data"));
  writeUint32LE(dataChunk, 4, 4);
  dataChunk.set(audio, 8);

  const body = new Uint8Array(4 + fmtChunk.length + dataChunk.length);
  body.set(enc.encode("WAVE"));
  body.set(fmtChunk, 4);
  body.set(dataChunk, 4 + fmtChunk.length);

  const wav = new Uint8Array(8 + body.length);
  wav.set(enc.encode("RIFF"));
  writeUint32LE(wav, 4, body.length);
  wav.set(body, 8);
  return wav;
}

/** Minimal MP3: sync bytes for one MPEG1 Layer3 frame header. */
function makeMinimalMp3(): Uint8Array {
  return new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00]);
}

/** Minimal FLAC: 'fLaC' marker + one STREAMINFO block (last). */
function makeMinimalFlac(): Uint8Array {
  const streaminfo = new Uint8Array(34); // all-zero placeholder
  const flac = new Uint8Array(4 + 4 + 34);
  const enc = new TextEncoder();
  flac.set(enc.encode("fLaC"));
  flac[4] = 0x80; // is_last=1, type=0 (STREAMINFO)
  flac[5] = 0x00;
  flac[6] = 0x00;
  flac[7] = 0x22; // size = 34
  flac.set(streaminfo, 8);
  return flac;
}

// ── writeMetadataToFile — WAV ─────────────────────────────────────────────────

describe("writeMetadataToFile — WAV", () => {
  let tmpPath: string;

  beforeEach(() => {
    tmpPath = path.join(os.tmpdir(), `crate-meta-test-${Date.now()}.wav`);
  });

  afterEach(() => fs.rmSync(tmpPath, { force: true }));

  test("embeds BPM in WAV LIST INFO chunk — readable back from file bytes", async () => {
    fs.writeFileSync(tmpPath, makeMinimalWav());
    await writeMetadataToFile({ path: tmpPath, bpm: 128 });
    const text = new TextDecoder("latin1").decode(new Uint8Array(fs.readFileSync(tmpPath).buffer));
    expect(text).toContain("IBPM");
    expect(text).toContain("128");
  });

  test("null bpm leaves file unchanged", async () => {
    const original = makeMinimalWav();
    fs.writeFileSync(tmpPath, original);
    await writeMetadataToFile({ path: tmpPath, bpm: null });
    const after = fs.readFileSync(tmpPath);
    expect(after.equals(Buffer.from(original))).toBe(true);
  });

  test("null key leaves file unchanged", async () => {
    const original = makeMinimalWav();
    fs.writeFileSync(tmpPath, original);
    await writeMetadataToFile({ path: tmpPath, key: null });
    const after = fs.readFileSync(tmpPath);
    expect(after.equals(Buffer.from(original))).toBe(true);
  });
});

// ── writeMetadataToFile — MP3 ─────────────────────────────────────────────────

describe("writeMetadataToFile — MP3", () => {
  let tmpPath: string;

  beforeEach(() => {
    tmpPath = path.join(os.tmpdir(), `crate-meta-test-${Date.now()}.mp3`);
  });

  afterEach(() => fs.rmSync(tmpPath, { force: true }));

  test("writes BPM to ID3v2 TBPM frame — readable back from file bytes", async () => {
    fs.writeFileSync(tmpPath, makeMinimalMp3());
    await writeMetadataToFile({ path: tmpPath, bpm: 140 });
    const text = new TextDecoder("latin1").decode(new Uint8Array(fs.readFileSync(tmpPath).buffer));
    expect(text).toContain("TBPM");
    expect(text).toContain("140");
  });
});

// ── writeMetadataToFile — FLAC ────────────────────────────────────────────────

describe("writeMetadataToFile — FLAC", () => {
  let tmpPath: string;

  beforeEach(() => {
    tmpPath = path.join(os.tmpdir(), `crate-meta-test-${Date.now()}.flac`);
  });

  afterEach(() => fs.rmSync(tmpPath, { force: true }));

  test("writes BPM to Vorbis comment block — readable back from file bytes", async () => {
    fs.writeFileSync(tmpPath, makeMinimalFlac());
    await writeMetadataToFile({ path: tmpPath, bpm: 96 });
    const text = new TextDecoder("utf-8").decode(new Uint8Array(fs.readFileSync(tmpPath).buffer));
    expect(text).toContain("BPM=96");
  });
});

// ── writeMetadataToFile — error handling ──────────────────────────────────────

describe("writeMetadataToFile — error handling", () => {
  test("throws with descriptive message when path does not exist", async () => {
    await expect(
      writeMetadataToFile({ path: "/nonexistent/path/file.wav", bpm: 128 }),
    ).rejects.toThrow(/not found|does not exist/i);
  });
});

// ── batchWriteMetadata ────────────────────────────────────────────────────────

describe("batchWriteMetadata", () => {
  let db: ReturnType<typeof makeDb>;
  let tmpPath: string;

  beforeEach(() => {
    db = makeDb();
    tmpPath = path.join(os.tmpdir(), `crate-batch-meta-${Date.now()}.wav`);
    fs.writeFileSync(tmpPath, makeMinimalWav());
  });

  afterEach(() => fs.rmSync(tmpPath, { force: true }));

  test("returns OperationRecord with operation 'metadata_write'", async () => {
    const record = await batchWriteMetadata([{ path: tmpPath, bpm: 128 }], db);
    expect(record.operation).toBe("metadata_write");
    expect(typeof record.id).toBe("number");
  });

  test("writes a log entry to file_operations_log", async () => {
    await batchWriteMetadata([{ path: tmpPath, bpm: 128 }], db);
    const log = db.getOperationsLog();
    expect(log.length).toBe(1);
    expect(log[0].operation).toBe("metadata_write");
  });
});
