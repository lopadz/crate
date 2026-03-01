import { describe, expect, test } from "bun:test";
import {
  isAiffFile,
  isWavFile,
  parseAiffChunks,
  parseWavChunks,
  read80BitFloat,
  readUint16BE,
  readUint16LE,
  readUint32BE,
  readUint32LE,
  writeUint32LE,
} from "./wavUtils";

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

// ── AIFF test helpers ─────────────────────────────────────────────────────────

function writeU16BE(buf: Uint8Array, offset: number, v: number): void {
  buf[offset] = (v >> 8) & 0xff;
  buf[offset + 1] = v & 0xff;
}

function writeU32BE(buf: Uint8Array, offset: number, v: number): void {
  buf[offset] = (v >> 24) & 0xff;
  buf[offset + 1] = (v >> 16) & 0xff;
  buf[offset + 2] = (v >> 8) & 0xff;
  buf[offset + 3] = v & 0xff;
}

/** Encodes a positive integer sample rate as 80-bit IEEE 754 extended (big-endian). */
function write80BitFloat(buf: Uint8Array, offset: number, value: number): void {
  const exp = Math.floor(Math.log2(value));
  const mantHi = Math.round(value * 2 ** (31 - exp)) >>> 0;
  const biasedExp = exp + 16383;
  buf[offset] = (biasedExp >> 8) & 0x7f;
  buf[offset + 1] = biasedExp & 0xff;
  buf[offset + 2] = (mantHi >>> 24) & 0xff;
  buf[offset + 3] = (mantHi >>> 16) & 0xff;
  buf[offset + 4] = (mantHi >>> 8) & 0xff;
  buf[offset + 5] = mantHi & 0xff;
  buf.fill(0, offset + 6, offset + 10);
}

/**
 * Builds a minimal valid FORM/AIFF buffer with silence.
 * Layout: FORM header (12) + COMM chunk (8+18) + SSND chunk (8+8+data).
 */
function makeAiff(numChannels = 1, numFrames = 4, bitDepth = 16, sampleRate = 44100): Uint8Array {
  const commSize = 18;
  const dataSize = numFrames * numChannels * (bitDepth >> 3);
  const ssndSize = 8 + dataSize;
  const total = 12 + 8 + commSize + 8 + ssndSize;
  const buf = new Uint8Array(total);

  writeStr(buf, 0, "FORM");
  writeU32BE(buf, 4, total - 8);
  writeStr(buf, 8, "AIFF");

  let off = 12;
  writeStr(buf, off, "COMM");
  off += 4;
  writeU32BE(buf, off, commSize);
  off += 4;
  writeU16BE(buf, off, numChannels);
  off += 2;
  writeU32BE(buf, off, numFrames);
  off += 4;
  writeU16BE(buf, off, bitDepth);
  off += 2;
  write80BitFloat(buf, off, sampleRate);
  off += 10;

  writeStr(buf, off, "SSND");
  off += 4;
  writeU32BE(buf, off, ssndSize);
  off += 4;
  writeU32BE(buf, off, 0);
  off += 4; // SSND offset field
  writeU32BE(buf, off, 0);
  off += 4; // SSND blockSize field

  return buf;
}

/**
 * Builds a minimal valid FORM/AIFC buffer with NONE compression type and silence.
 * COMM is 24 bytes: 18 (base) + 4 (compressionType) + 2 (empty pascal string).
 */
function makeAifc(): Uint8Array {
  const commSize = 24;
  const ssndSize = 8 + 8; // 8 header fields + 8 bytes silence
  const total = 12 + 8 + commSize + 8 + ssndSize;
  const buf = new Uint8Array(total);

  writeStr(buf, 0, "FORM");
  writeU32BE(buf, 4, total - 8);
  writeStr(buf, 8, "AIFC");

  let off = 12;
  writeStr(buf, off, "COMM");
  off += 4;
  writeU32BE(buf, off, commSize);
  off += 4;
  writeU16BE(buf, off, 1);
  off += 2; // numChannels
  writeU32BE(buf, off, 4);
  off += 4; // numFrames
  writeU16BE(buf, off, 16);
  off += 2; // bitDepth
  write80BitFloat(buf, off, 44100);
  off += 10;
  writeStr(buf, off, "NONE");
  off += 4; // compressionType
  buf[off] = 0;
  off += 1; // pstring length = 0
  buf[off] = 0;
  off += 1; // pad byte

  writeStr(buf, off, "SSND");
  off += 4;
  writeU32BE(buf, off, ssndSize);
  off += 4;
  writeU32BE(buf, off, 0);
  off += 4;
  writeU32BE(buf, off, 0);
  off += 4;

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

// ── readUint16BE ───────────────────────────────────────────────────────────────

describe("readUint16BE", () => {
  test("reads big-endian 16-bit at offset", () => {
    const buf = new Uint8Array([0x00, 0x00, 0x12, 0x34]); // 0x1234 at offset 2
    expect(readUint16BE(buf, 2)).toBe(0x1234);
  });
});

// ── readUint32BE ───────────────────────────────────────────────────────────────

describe("readUint32BE", () => {
  test("reads big-endian 32-bit at offset", () => {
    const buf = new Uint8Array([0x00, 0x12, 0x34, 0x56, 0x78]);
    expect(readUint32BE(buf, 1)).toBe(0x12345678);
  });
});

// ── read80BitFloat ────────────────────────────────────────────────────────────

describe("read80BitFloat", () => {
  test("reads 44100 Hz encoded as 80-bit extended", () => {
    // 44100: biasedExp=0x400E, mantHi=0xAC440000
    const buf = new Uint8Array([0x40, 0x0e, 0xac, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(read80BitFloat(buf, 0)).toBe(44100);
  });

  test("returns 0 for all-zero buffer", () => {
    expect(read80BitFloat(new Uint8Array(10), 0)).toBe(0);
  });
});

// ── isAiffFile ────────────────────────────────────────────────────────────────

describe("isAiffFile", () => {
  test("returns true for a valid FORM/AIFF buffer", () => {
    expect(isAiffFile(makeAiff())).toBe(true);
  });

  test("returns true for a valid FORM/AIFC buffer", () => {
    expect(isAiffFile(makeAifc())).toBe(true);
  });

  test("returns false for a WAV buffer", () => {
    expect(isAiffFile(makeWav())).toBe(false);
  });

  test("returns false for a short buffer", () => {
    expect(isAiffFile(new Uint8Array(4))).toBe(false);
  });
});

// ── parseAiffChunks ───────────────────────────────────────────────────────────

describe("parseAiffChunks", () => {
  test("returns array including a COMM entry for valid AIFF", () => {
    const chunks = parseAiffChunks(makeAiff());
    expect(chunks).not.toBeNull();
    expect(chunks?.some((c) => c.id === "COMM")).toBe(true);
  });

  test("returns array including an SSND entry for valid AIFF", () => {
    const chunks = parseAiffChunks(makeAiff());
    expect(chunks?.some((c) => c.id === "SSND")).toBe(true);
  });

  test("SSND chunk offset points to start of chunk data (past 8-byte header)", () => {
    // FORM(12) + COMM chunk(8+18=26) + SSND header(8) = 46
    const chunks = parseAiffChunks(makeAiff());
    const ssnd = chunks?.find((c) => c.id === "SSND");
    expect(ssnd?.offset).toBe(46);
  });

  test("returns null for non-AIFF buffer", () => {
    expect(parseAiffChunks(new Uint8Array(48))).toBeNull();
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
