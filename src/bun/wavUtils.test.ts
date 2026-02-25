import { describe, expect, test } from "bun:test";
import { isWavFile, parseWavChunks, readUint16LE, readUint32LE, writeUint32LE } from "./wavUtils";

// ── Helpers ────────────────────────────────────────────────────────────────────

function writeStr(buf: Uint8Array, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) buf[offset + i] = s.charCodeAt(i);
}

function writeU16LE(buf: Uint8Array, offset: number, v: number): void {
  buf[offset] = v & 0xff;
  buf[offset + 1] = (v >> 8) & 0xff;
}

function writeU32LE(buf: Uint8Array, offset: number, v: number): void {
  buf[offset] = v & 0xff;
  buf[offset + 1] = (v >> 8) & 0xff;
  buf[offset + 2] = (v >> 16) & 0xff;
  buf[offset + 3] = (v >> 24) & 0xff;
}

/**
 * Builds a minimal valid PCM WAV buffer.
 * Structure: RIFF header | fmt  chunk (16 bytes) | data chunk (dataSize bytes)
 */
function makeWav(dataSize = 4): Uint8Array {
  const total = 12 + 24 + 8 + dataSize;
  const buf = new Uint8Array(total);
  writeStr(buf, 0, "RIFF");
  writeU32LE(buf, 4, total - 8);
  writeStr(buf, 8, "WAVE");
  // fmt  chunk
  writeStr(buf, 12, "fmt ");
  writeU32LE(buf, 16, 16); // chunk size
  writeU16LE(buf, 20, 1); // PCM
  writeU16LE(buf, 22, 1); // mono
  writeU32LE(buf, 24, 44100); // sample rate
  writeU32LE(buf, 28, 88200); // byte rate
  writeU16LE(buf, 32, 2); // block align
  writeU16LE(buf, 34, 16); // bits per sample
  // data chunk
  writeStr(buf, 36, "data");
  writeU32LE(buf, 40, dataSize);
  return buf;
}

/**
 * Builds a WAV with an odd-sized custom chunk before fmt and data,
 * to verify word-alignment is correctly applied during chunk parsing.
 */
function makeWavWithOddChunk(): Uint8Array {
  // RIFF(12) + odd_chunk(8+3+1pad) + fmt(8+16) + data(8+4)
  const total = 12 + 12 + 24 + 12;
  const buf = new Uint8Array(total);
  writeStr(buf, 0, "RIFF");
  writeU32LE(buf, 4, total - 8);
  writeStr(buf, 8, "WAVE");
  // odd chunk: size=3, pad byte follows
  writeStr(buf, 12, "test");
  writeU32LE(buf, 16, 3); // odd size
  buf[20] = 0x01;
  buf[21] = 0x02;
  buf[22] = 0x03;
  // pad byte at 23 (implicit zero)
  // fmt  chunk at offset 24
  writeStr(buf, 24, "fmt ");
  writeU32LE(buf, 28, 16);
  writeU16LE(buf, 32, 1);
  writeU16LE(buf, 34, 1);
  writeU32LE(buf, 36, 44100);
  writeU32LE(buf, 40, 88200);
  writeU16LE(buf, 44, 2);
  writeU16LE(buf, 46, 16);
  // data chunk at offset 48
  writeStr(buf, 48, "data");
  writeU32LE(buf, 52, 4);
  return buf;
}

// ── readUint16LE ───────────────────────────────────────────────────────────────

describe("readUint16LE", () => {
  test("reads little-endian 16-bit at offset", () => {
    const buf = new Uint8Array([0x00, 0x00, 0x34, 0x12]); // 0x1234 at offset 2
    expect(readUint16LE(buf, 2)).toBe(0x1234);
  });
});

// ── readUint32LE ───────────────────────────────────────────────────────────────

describe("readUint32LE", () => {
  test("reads little-endian 32-bit at offset", () => {
    const buf = new Uint8Array([0x00, 0x78, 0x56, 0x34, 0x12]);
    expect(readUint32LE(buf, 1)).toBe(0x12345678);
  });
});

// ── writeUint32LE ──────────────────────────────────────────────────────────────

describe("writeUint32LE", () => {
  test("writes little-endian 32-bit at offset", () => {
    const buf = new Uint8Array(4);
    writeUint32LE(buf, 0, 0xdeadbeef);
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbe);
    expect(buf[2]).toBe(0xad);
    expect(buf[3]).toBe(0xde);
  });
});

// ── isWavFile ─────────────────────────────────────────────────────────────────

describe("isWavFile", () => {
  test("returns true for a valid RIFF/WAVE buffer", () => {
    expect(isWavFile(makeWav())).toBe(true);
  });

  test("returns false for a random buffer", () => {
    const buf = new Uint8Array([
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
    ]);
    expect(isWavFile(buf)).toBe(false);
  });
});

// ── parseWavChunks ────────────────────────────────────────────────────────────

describe("parseWavChunks", () => {
  test("returns array including a fmt  entry for a valid WAV", () => {
    const chunks = parseWavChunks(makeWav());
    expect(chunks).not.toBeNull();
    expect(chunks?.some((c) => c.id === "fmt ")).toBe(true);
  });

  test("returns null for a non-WAV buffer", () => {
    const buf = new Uint8Array(48);
    expect(parseWavChunks(buf)).toBeNull();
  });

  test("finds data chunk with correct offset and size", () => {
    const dataSize = 8;
    const chunks = parseWavChunks(makeWav(dataSize));
    const dataChunk = chunks?.find((c) => c.id === "data");
    expect(dataChunk).toBeDefined();
    // data content starts at: 12 (RIFF hdr) + 24 (fmt  chunk) + 8 (data hdr) = 44
    expect(dataChunk?.offset).toBe(44);
    expect(dataChunk?.size).toBe(dataSize);
  });

  test("handles word-alignment padding between chunks", () => {
    const chunks = parseWavChunks(makeWavWithOddChunk());
    expect(chunks).not.toBeNull();
    // Should find all 3 chunks: test, fmt , data
    expect(chunks?.map((c) => c.id)).toEqual(["test", "fmt ", "data"]);
    // data chunk starts at 48+8=56
    const dataChunk = chunks?.find((c) => c.id === "data");
    expect(dataChunk?.offset).toBe(56);
  });
});
