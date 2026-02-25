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

// ── Chunk navigation ──────────────────────────────────────────────────────────

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
