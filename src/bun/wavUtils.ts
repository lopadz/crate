/**
 * Shared WAV binary primitives used by analysisWorker and metadataWriter.
 *
 * Provides byte readers/writers, RIFF/WAVE validation, and chunk navigation.
 */

// ── Byte readers/writers ──────────────────────────────────────────────────────

export function readUint16LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

export function readUint32LE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0
  );
}

export function writeUint32LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
  buf[offset + 2] = (value >> 16) & 0xff;
  buf[offset + 3] = (value >> 24) & 0xff;
}

// ── Big-endian readers ────────────────────────────────────────────────────────

export function readUint16BE(buf: Uint8Array, offset: number): number {
  return (buf[offset] << 8) | buf[offset + 1];
}

export function readUint32BE(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0
  );
}

/**
 * Reads an 80-bit IEEE 754 extended-precision float (big-endian).
 * Used for the sample rate field in AIFF COMM chunks.
 */
export function read80BitFloat(buf: Uint8Array, offset: number): number {
  const exp = ((buf[offset] & 0x7f) << 8) | buf[offset + 1];
  const mantHi =
    ((buf[offset + 2] << 24) |
      (buf[offset + 3] << 16) |
      (buf[offset + 4] << 8) |
      buf[offset + 5]) >>>
    0;
  const mantLo =
    ((buf[offset + 6] << 24) |
      (buf[offset + 7] << 16) |
      (buf[offset + 8] << 8) |
      buf[offset + 9]) >>>
    0;
  if (exp === 0 && mantHi === 0 && mantLo === 0) return 0;
  return mantHi * 2 ** (exp - 16383 - 31) + mantLo * 2 ** (exp - 16383 - 63);
}

// ── WAV chunk navigation ───────────────────────────────────────────────────────

export type WavChunk = { id: string; offset: number; size: number };

/**
 * Validates that `buf` is a RIFF/WAVE file.
 * Returns true if the buffer starts with the RIFF....WAVE magic bytes.
 */
export function isWavFile(buf: Uint8Array): boolean {
  return (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 &&
    buf[9] === 0x41 &&
    buf[10] === 0x56 &&
    buf[11] === 0x45 // WAVE
  );
}

// ── AIFF chunk navigation ─────────────────────────────────────────────────────

export type AiffChunk = { id: string; offset: number; size: number };

/**
 * Validates that `buf` is a FORM/AIFF or FORM/AIFC file.
 */
export function isAiffFile(buf: Uint8Array): boolean {
  if (buf.length < 12) return false;
  if (buf[0] !== 0x46 || buf[1] !== 0x4f || buf[2] !== 0x52 || buf[3] !== 0x4d) return false; // FORM
  const form = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
  return form === "AIFF" || form === "AIFC";
}

/**
 * Parses all IFF chunks in an AIFF or AIFF-C file.
 * Returns null if buf is not a valid FORM/AIFF or FORM/AIFC file.
 * Each chunk's `offset` points to the first byte of chunk data (after the 8-byte header).
 */
export function parseAiffChunks(buf: Uint8Array): AiffChunk[] | null {
  if (!isAiffFile(buf)) return null;

  const chunks: AiffChunk[] = [];
  let offset = 12; // skip 12-byte FORM container header

  while (offset + 8 <= buf.length) {
    const id = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
    const size = readUint32BE(buf, offset + 4);
    const dataOffset = offset + 8;
    chunks.push({ id, offset: dataOffset, size });
    offset = dataOffset + size + (size & 1); // advance, applying word-align padding
  }

  return chunks;
}

/**
 * Parses all RIFF chunks in a WAV file.
 * Returns null if buf is not a valid RIFF/WAVE file.
 * Returns all chunks found (fmt , data, bext, LIST, INFO, etc.).
 * Each chunk's `offset` points to the first byte of chunk data (after the 8-byte header).
 */
export function parseWavChunks(buf: Uint8Array): WavChunk[] | null {
  if (!isWavFile(buf)) return null;

  const chunks: WavChunk[] = [];
  let offset = 12; // skip 12-byte RIFF container header

  while (offset + 8 <= buf.length) {
    const id = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
    const size = readUint32LE(buf, offset + 4);
    const dataOffset = offset + 8;
    chunks.push({ id, offset: dataOffset, size });
    offset = dataOffset + size + (size & 1); // advance, applying word-align padding
  }

  return chunks;
}
