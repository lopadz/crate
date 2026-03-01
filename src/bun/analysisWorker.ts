/**
 * Bun Worker thread: decodes an audio file to PCM and runs analysis.
 *
 * Receives: { type: "ANALYZE", compositeId: string, path: string }
 * Posts:    { type: "RESULT", compositeId, bpm, key, keyCamelot, lufsIntegrated, lufsPeak, dynamicRange, duration, sampleRate }
 *      or:  { type: "ERROR",  compositeId, error: string }
 *
 * Supported formats: WAV (fast path), AIFF/AIFF-C (fast path), MP3 (fast path via mpg123-decoder), FLAC, OGG, OPUS (via audio-decode).
 * Duration is computed via mediabunny (pure-TS demuxer, no WebCodecs needed).
 */

import audioDecode from "audio-decode";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { MPEGDecoder } from "mpg123-decoder";
import { detectBpm } from "./bpmDetection";
import { detectKey } from "./keyDetection";
import { measureLufs } from "./lufs";
import {
  parseAiffChunks,
  parseWavChunks,
  read80BitFloat,
  readUint16BE,
  readUint16LE,
  readUint32BE,
  readUint32LE,
} from "./wavUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WavData {
  mono: Float32Array;
  sampleRate: number;
}

// ─── WAV fast-path decoder ────────────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: PCM sample-type branching is inherently complex
function decodeWav(buffer: ArrayBuffer): WavData | null {
  const buf = new Uint8Array(buffer);
  const chunks = parseWavChunks(buf);
  if (!chunks) return null;

  let fmtTag = 0,
    channels = 0,
    sampleRate = 0,
    bitDepth = 0;
  let dataOffset = -1,
    dataSize = -1;

  for (const chunk of chunks) {
    if (chunk.id === "fmt ") {
      fmtTag = readUint16LE(buf, chunk.offset); // 1=PCM, 3=IEEE float, 65534=extensible
      channels = readUint16LE(buf, chunk.offset + 2);
      sampleRate = readUint32LE(buf, chunk.offset + 4);
      bitDepth = readUint16LE(buf, chunk.offset + 14);
      // For extensible format, real format is in the SubFormat GUID.
      // Extensible fmt layout: cbSize at offset 16, SubFormat GUID at offset 24.
      // We need at least 26 bytes of fmt data to read the first two GUID bytes.
      if (fmtTag === 65534 && chunk.size >= 26) {
        fmtTag = readUint16LE(buf, chunk.offset + 24); // sub-format GUID low bytes
      }
    } else if (chunk.id === "data") {
      dataOffset = chunk.offset;
      dataSize = chunk.size;
    }
    if (channels > 0 && dataOffset >= 0) break;
  }

  if (channels === 0 || sampleRate === 0 || dataOffset < 0) return null;
  if (fmtTag !== 1 && fmtTag !== 3) return null; // unsupported compression

  const bytesPerSample = (bitDepth + 7) >> 3;
  const totalSamples = Math.floor(dataSize / (bytesPerSample * channels));
  const mono = new Float32Array(totalSamples);
  const view = new DataView(buffer);

  for (let i = 0; i < totalSamples; i++) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch++) {
      const pos = dataOffset + (i * channels + ch) * bytesPerSample;
      let sample = 0;
      if (fmtTag === 3 && bitDepth === 32) {
        sample = view.getFloat32(pos, true);
      } else if (bitDepth === 16) {
        sample = view.getInt16(pos, true) / 32768;
      } else if (bitDepth === 24) {
        const b0 = buf[pos],
          b1 = buf[pos + 1],
          b2 = buf[pos + 2];
        let v = b0 | (b1 << 8) | (b2 << 16);
        if (v & 0x800000) v |= ~0xffffff; // sign-extend
        sample = v / 8388608;
      } else if (bitDepth === 32 && fmtTag === 1) {
        sample = view.getInt32(pos, true) / 2147483648;
      }
      sum += sample;
    }
    mono[i] = sum / channels;
  }

  return { mono, sampleRate };
}

// ─── AIFF fast-path decoder ───────────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: PCM sample-type branching mirrors decodeWav
function decodeAiff(buffer: ArrayBuffer): WavData | null {
  const buf = new Uint8Array(buffer);
  const chunks = parseAiffChunks(buf);
  if (!chunks) return null;

  const comm = chunks.find((c) => c.id === "COMM");
  if (!comm || comm.size < 18) return null;

  const channels = readUint16BE(buf, comm.offset);
  const numSampleFrames = readUint32BE(buf, comm.offset + 2);
  const bitDepth = readUint16BE(buf, comm.offset + 6);
  const sampleRate = read80BitFloat(buf, comm.offset + 8);

  // Check compression type for AIFF-C (AIFC marker at bytes 8-11)
  const isAifc = buf[8] === 0x41 && buf[9] === 0x49 && buf[10] === 0x46 && buf[11] === 0x43;
  let littleEndian = false;
  if (isAifc) {
    if (comm.size < 22) return null;
    const ct = String.fromCharCode(
      buf[comm.offset + 18],
      buf[comm.offset + 19],
      buf[comm.offset + 20],
      buf[comm.offset + 21],
    );
    if (ct !== "NONE" && ct !== "sowt") return null; // unsupported compression
    littleEndian = ct === "sowt";
  }

  const ssnd = chunks.find((c) => c.id === "SSND");
  if (!ssnd || channels === 0 || sampleRate === 0) return null;

  const ssndSkip = readUint32BE(buf, ssnd.offset); // SSND 'offset' field, usually 0
  const dataStart = ssnd.offset + 8 + ssndSkip; // skip offset(4) + blockSize(4)
  const bytesPerSample = (bitDepth + 7) >> 3;
  const mono = new Float32Array(numSampleFrames);
  const view = new DataView(buffer);

  for (let i = 0; i < numSampleFrames; i++) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch++) {
      const pos = dataStart + (i * channels + ch) * bytesPerSample;
      let sample = 0;
      if (bitDepth === 8) {
        sample = view.getInt8(pos) / 128;
      } else if (bitDepth === 16) {
        sample = view.getInt16(pos, littleEndian) / 32768;
      } else if (bitDepth === 24) {
        let v: number;
        if (littleEndian) {
          v = buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16);
        } else {
          v = (buf[pos] << 16) | (buf[pos + 1] << 8) | buf[pos + 2];
        }
        if (v & 0x800000) v |= ~0xffffff; // sign-extend
        sample = v / 8388608;
      } else if (bitDepth === 32) {
        sample = view.getInt32(pos, littleEndian) / 2147483648;
      }
      sum += sample;
    }
    mono[i] = sum / channels;
  }

  return { mono, sampleRate };
}

// ─── Multi-channel to mono mix ────────────────────────────────────────────────

function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const len = channels[0].length;
  const mono = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i];
    mono[i] = sum / channels.length;
  }
  return mono;
}

// ─── MP3 fast-path decoder ────────────────────────────────────────────────────

// Bypasses audio-decode's audioType() format detection, which misidentifies
// some MP3 files (those whose bytes 4–7 happen to spell "ftyp") as M4A.
async function decodeMp3(buffer: ArrayBuffer): Promise<WavData | null> {
  const decoder = new MPEGDecoder();
  await decoder.ready;
  const result = decoder.decode(new Uint8Array(buffer));
  decoder.free();
  if (result.samplesDecoded === 0) return null;
  return { mono: mixToMono(result.channelData), sampleRate: result.sampleRate };
}

// ─── Multi-format decoder ─────────────────────────────────────────────────────

/**
 * Decodes any supported audio format to mono PCM + sample rate.
 *
 * Fast path: WAV uses the hand-rolled PCM decoder; MP3 uses mpg123-decoder directly.
 * Fallback: audio-decode handles FLAC, OGG, OPUS, and non-PCM WAVs.
 *
 * Exported for unit testing.
 */
export async function decodeAudio(buffer: ArrayBuffer, path: string): Promise<WavData | null> {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "aif" || ext === "aiff") {
    return decodeAiff(buffer); // audio-decode doesn't handle AIFF, no fallback needed
  }
  if (ext === "wav") {
    const result = decodeWav(buffer);
    if (result) return result;
    // Fall through to audio-decode for non-PCM WAV (e.g. ADPCM, float extensible)
  }
  if (ext === "mp3") {
    return decodeMp3(buffer);
  }
  try {
    const decoded = await audioDecode(buffer);
    const channels: Float32Array[] = [];
    for (let i = 0; i < decoded.numberOfChannels; i++) {
      channels.push(decoded.getChannelData(i));
    }
    const mono = mixToMono(channels);
    return { mono, sampleRate: decoded.sampleRate };
  } catch {
    return null;
  }
}

// ─── Duration via mediabunny demuxer (no WebCodecs needed) ───────────────────

async function computeDuration(buffer: ArrayBuffer): Promise<number | null> {
  // AIFF fast path: derive duration from COMM chunk (mediabunny doesn't support AIFF)
  const buf = new Uint8Array(buffer);
  const aiffChunks = parseAiffChunks(buf);
  if (aiffChunks) {
    const comm = aiffChunks.find((c) => c.id === "COMM");
    if (comm && comm.size >= 18) {
      const numSampleFrames = readUint32BE(buf, comm.offset + 2);
      const sampleRate = read80BitFloat(buf, comm.offset + 8);
      if (sampleRate > 0) return numSampleFrames / sampleRate;
    }
  }
  // Fall back to mediabunny for all other formats
  try {
    const input = new Input({ source: new BufferSource(buffer), formats: ALL_FORMATS });
    return await input.computeDuration();
  } catch {
    return null;
  }
}

// ─── Worker message handler ───────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent) => {
  const { compositeId, path } = event.data as {
    compositeId: string;
    path: string;
  };

  try {
    const buffer = await Bun.file(path).arrayBuffer();
    const [decoded, duration] = await Promise.all([
      decodeAudio(buffer, path),
      computeDuration(buffer),
    ]);

    if (!decoded) {
      // Unsupported format — return empty analysis rather than error
      self.postMessage({
        type: "RESULT",
        compositeId,
        bpm: null,
        key: null,
        keyCamelot: null,
        lufsIntegrated: -Infinity,
        lufsPeak: 0,
        dynamicRange: 0,
        duration,
        sampleRate: null,
      });
      return;
    }

    const { mono, sampleRate } = decoded;
    const lufs = measureLufs(mono, sampleRate);
    const bpm = detectBpm(mono, sampleRate);
    const keyResult = detectKey(mono, sampleRate);

    self.postMessage({
      type: "RESULT",
      compositeId,
      bpm,
      key: keyResult?.key ?? null,
      keyCamelot: keyResult?.camelot ?? null,
      lufsIntegrated: lufs.integrated,
      lufsPeak: lufs.truePeak,
      dynamicRange: lufs.dynamicRange,
      duration,
      sampleRate,
    });
  } catch (err) {
    self.postMessage({
      type: "ERROR",
      compositeId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
