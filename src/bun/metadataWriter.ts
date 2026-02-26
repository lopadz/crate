/**
 * Per-format binary metadata patching for audio files.
 *
 * Architecture decision: Mediabunny v1.34.4 has a metadata write API
 * (Output.setMetadataTags + MetadataTags.raw), but it is browser/WebCodecs-
 * oriented and only runs in the WebView renderer context. This module runs in
 * the Bun backend where WebCodecs are unavailable. We therefore implement
 * direct binary patching:
 *
 *   WAV  → Append/replace a RIFF LIST INFO chunk.
 *           BPM → IBPM tag, key → IKEY tag, LUFS → ILFS tag.
 *
 *   MP3  → Prepend/replace an ID3v2.3 tag at the start of the file.
 *           BPM → TBPM frame, key → TKEY frame.
 *
 *   FLAC → Add/update a Vorbis comment metadata block.
 *           BPM → BPM=, key → KEY=, LUFS → LUFS=.
 *
 * Other formats (AIFF, OGG, M4A) are skipped with a console warning.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { QueryHelpers } from "./db";
import type { FileOpEntry, OperationRecord } from "./fileOps";
import { parseWavChunks, readUint32LE, writeUint32LE } from "./wavUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetadataWriteJob = {
  path: string;
  bpm?: number | null;
  key?: string | null;
  lufs?: number | null;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// ─── WAV: RIFF LIST INFO ──────────────────────────────────────────────────────

function buildListInfoChunk(tags: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();
  const items: Uint8Array[] = [];

  for (const [key, val] of Object.entries(tags)) {
    const valBytes = enc.encode(`${val}\0`); // null-terminated
    const padded = valBytes.length % 2 === 0 ? valBytes : concat(valBytes, new Uint8Array([0]));
    const header = new Uint8Array(8);
    header.set(enc.encode(key.slice(0, 4)));
    writeUint32LE(header, 4, valBytes.length); // size = data without padding
    items.push(header, padded);
  }

  const infoItems = concat(...items);
  const listSize = 4 + infoItems.length; // 'INFO' + items
  const listHeader = new Uint8Array(8);
  listHeader.set(enc.encode("LIST"));
  writeUint32LE(listHeader, 4, listSize);

  return concat(listHeader, enc.encode("INFO"), infoItems);
}

function patchWav(buf: Uint8Array, tags: Record<string, string>): Uint8Array {
  const chunks = parseWavChunks(buf);
  if (!chunks) throw new Error("Not a valid WAV file");

  const parts: Uint8Array[] = [buf.slice(0, 12)]; // 'RIFF' + size + 'WAVE'

  for (const chunk of chunks) {
    if (chunk.id === "LIST") {
      // Check list type ('INFO' starts at chunk.offset, the data start)
      const listType = String.fromCharCode(
        buf[chunk.offset],
        buf[chunk.offset + 1],
        buf[chunk.offset + 2],
        buf[chunk.offset + 3],
      );
      if (listType === "INFO") continue; // drop; we'll append fresh one below
    }
    const headerStart = chunk.offset - 8;
    const chunkEnd = chunk.offset + chunk.size + (chunk.size % 2);
    parts.push(buf.slice(headerStart, chunkEnd));
  }

  parts.push(buildListInfoChunk(tags));
  const result = concat(...parts);
  writeUint32LE(result, 4, result.length - 8); // update RIFF container size
  return result;
}

// ─── MP3: ID3v2.3 tag ─────────────────────────────────────────────────────────

function toSyncsafe4(n: number): Uint8Array {
  return new Uint8Array([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]);
}

function fromSyncsafe4(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] & 0x7f) << 21) |
    ((buf[offset + 1] & 0x7f) << 14) |
    ((buf[offset + 2] & 0x7f) << 7) |
    (buf[offset + 3] & 0x7f)
  );
}

function buildId3Frame(id: string, value: string): Uint8Array {
  const enc = new TextEncoder();
  const valueBytes = enc.encode(value);
  const frameSize = 1 + valueBytes.length; // encoding byte + text
  const frame = new Uint8Array(10 + frameSize);
  frame.set(enc.encode(id.slice(0, 4)));
  // Frame size: 4-byte big-endian (NOT syncsafe in ID3v2.3)
  frame[4] = (frameSize >> 24) & 0xff;
  frame[5] = (frameSize >> 16) & 0xff;
  frame[6] = (frameSize >> 8) & 0xff;
  frame[7] = frameSize & 0xff;
  frame[8] = 0x00; // flags
  frame[9] = 0x00;
  frame[10] = 0x00; // encoding: ISO-8859-1
  frame.set(valueBytes, 11);
  return frame;
}

function patchMp3(buf: Uint8Array, tags: Record<string, string>): Uint8Array {
  // Strip existing ID3v2 tag if present
  let audioStart = 0;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    // 'ID3'
    const tagSize = fromSyncsafe4(buf, 6);
    audioStart = 10 + tagSize;
    if (buf[5] & 0x10) audioStart += 10; // footer flag
  }

  const frames: Uint8Array[] = [];
  if (tags.TBPM) frames.push(buildId3Frame("TBPM", tags.TBPM));
  if (tags.TKEY) frames.push(buildId3Frame("TKEY", tags.TKEY));

  const framesData = frames.length > 0 ? concat(...frames) : new Uint8Array(0);

  // ID3v2.3 header: 'ID3' + 0x03 0x00 + flags(0) + syncsafe size
  const header = new Uint8Array(10);
  header.set(new TextEncoder().encode("ID3"));
  header[3] = 0x03;
  header[4] = 0x00;
  header[5] = 0x00;
  header.set(toSyncsafe4(framesData.length), 6);

  return concat(header, framesData, buf.slice(audioStart));
}

// ─── FLAC: Vorbis comment block ───────────────────────────────────────────────

interface FlacBlock {
  isLast: boolean;
  type: number;
  data: Uint8Array;
}

function parseFlacBlocks(buf: Uint8Array): { blocks: FlacBlock[]; audioOffset: number } | null {
  if (buf.length < 4 || buf[0] !== 0x66 || buf[1] !== 0x4c || buf[2] !== 0x61 || buf[3] !== 0x43)
    return null; // not 'fLaC'

  const blocks: FlacBlock[] = [];
  let pos = 4;

  while (pos + 4 <= buf.length) {
    const headerByte = buf[pos];
    const isLast = (headerByte & 0x80) !== 0;
    const type = headerByte & 0x7f;
    if (type === 127) break;
    const size = (buf[pos + 1] << 16) | (buf[pos + 2] << 8) | buf[pos + 3];
    blocks.push({ isLast, type, data: buf.slice(pos + 4, pos + 4 + size) });
    pos += 4 + size;
    if (isLast) break;
  }

  return { blocks, audioOffset: pos };
}

function buildVorbisCommentData(
  existingData: Uint8Array | null,
  tags: Record<string, string>,
): Uint8Array {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // Preserve existing comments whose keys don't overlap with new ones
  const kept: string[] = [];
  if (existingData) {
    const vendorLen = readUint32LE(existingData, 0);
    const numComments = readUint32LE(existingData, 4 + vendorLen);
    let p = 4 + vendorLen + 4;
    for (let i = 0; i < numComments; i++) {
      const cLen = readUint32LE(existingData, p);
      const comment = dec.decode(existingData.slice(p + 4, p + 4 + cLen));
      const cKey = comment.split("=")[0].toUpperCase();
      if (!Object.keys(tags).includes(cKey)) kept.push(comment);
      p += 4 + cLen;
    }
  }

  const allComments = [...kept, ...Object.entries(tags).map(([k, v]) => `${k}=${v}`)];
  const vendorBytes = enc.encode("crate");
  const commentBytes = allComments.map((c) => enc.encode(c));

  let size = 4 + vendorBytes.length + 4;
  for (const cb of commentBytes) size += 4 + cb.length;

  const out = new Uint8Array(size);
  let p = 0;
  writeUint32LE(out, p, vendorBytes.length);
  p += 4;
  out.set(vendorBytes, p);
  p += vendorBytes.length;
  writeUint32LE(out, p, allComments.length);
  p += 4;
  for (const cb of commentBytes) {
    writeUint32LE(out, p, cb.length);
    p += 4;
    out.set(cb, p);
    p += cb.length;
  }
  return out;
}

function patchFlac(buf: Uint8Array, tags: Record<string, string>): Uint8Array {
  const parsed = parseFlacBlocks(buf);
  if (!parsed) throw new Error("Not a valid FLAC file");

  const { blocks, audioOffset } = parsed;
  const audioData = buf.slice(audioOffset);

  const vcIdx = blocks.findIndex((b) => b.type === 4);
  const newVcData = buildVorbisCommentData(vcIdx >= 0 ? blocks[vcIdx].data : null, tags);

  let newBlocks: FlacBlock[] =
    vcIdx >= 0
      ? blocks.map((b, i) => (i === vcIdx ? { ...b, data: newVcData } : b))
      : [blocks[0], { isLast: false, type: 4, data: newVcData }, ...blocks.slice(1)];

  // Update isLast flags
  newBlocks = newBlocks.map((b, i) => ({ ...b, isLast: i === newBlocks.length - 1 }));

  const parts: Uint8Array[] = [new Uint8Array([0x66, 0x4c, 0x61, 0x43])]; // 'fLaC'
  for (const block of newBlocks) {
    const header = new Uint8Array(4);
    header[0] = (block.isLast ? 0x80 : 0x00) | block.type;
    header[1] = (block.data.length >> 16) & 0xff;
    header[2] = (block.data.length >> 8) & 0xff;
    header[3] = block.data.length & 0xff;
    parts.push(header, block.data);
  }
  parts.push(audioData);
  return concat(...parts);
}

// ─── Per-format patch helpers ─────────────────────────────────────────────────

function applyWavTags(buf: Uint8Array, job: MetadataWriteJob): Uint8Array | null {
  const tags: Record<string, string> = {};
  if (job.bpm != null) tags.IBPM = String(Math.round(job.bpm));
  if (job.key != null) tags.IKEY = job.key;
  if (job.lufs != null) tags.ILFS = job.lufs.toFixed(1);
  return Object.keys(tags).length > 0 ? patchWav(buf, tags) : null;
}

function applyMp3Tags(buf: Uint8Array, job: MetadataWriteJob): Uint8Array | null {
  const tags: Record<string, string> = {};
  if (job.bpm != null) tags.TBPM = String(Math.round(job.bpm));
  if (job.key != null) tags.TKEY = job.key;
  return Object.keys(tags).length > 0 ? patchMp3(buf, tags) : null;
}

function applyFlacTags(buf: Uint8Array, job: MetadataWriteJob): Uint8Array | null {
  const tags: Record<string, string> = {};
  if (job.bpm != null) tags.BPM = String(Math.round(job.bpm));
  if (job.key != null) tags.KEY = job.key;
  if (job.lufs != null) tags.LUFS = job.lufs.toFixed(1);
  return Object.keys(tags).length > 0 ? patchFlac(buf, tags) : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function writeMetadataToFile(job: MetadataWriteJob): Promise<void> {
  if (!fs.existsSync(job.path)) {
    throw new Error(`File not found: ${job.path}`);
  }

  const ext = path.extname(job.path).toLowerCase();
  const buf = new Uint8Array(await Bun.file(job.path).arrayBuffer());

  let result: Uint8Array | null = null;
  if (ext === ".wav") result = applyWavTags(buf, job);
  else if (ext === ".mp3") result = applyMp3Tags(buf, job);
  else if (ext === ".flac") result = applyFlacTags(buf, job);
  else console.warn(`metadataWriter: unsupported format ${ext}, skipping ${job.path}`);

  if (result !== null) await Bun.write(job.path, result);
}

export async function batchWriteMetadata(
  jobs: MetadataWriteJob[],
  db: QueryHelpers,
): Promise<OperationRecord> {
  for (const job of jobs) {
    await writeMetadataToFile(job);
  }

  const entries: FileOpEntry[] = jobs.map((j) => ({ originalPath: j.path, newPath: j.path }));
  const timestamp = Date.now();
  const id = db.logOperation({ operation: "metadata_write", filesJson: JSON.stringify(entries) });

  return { id, operation: "metadata_write", files: entries, timestamp, rolledBackAt: null };
}
