/**
 * Bun Worker thread: decodes an audio file to PCM and runs analysis.
 *
 * Receives: { type: "ANALYZE", compositeId: string, path: string }
 * Posts:    { type: "RESULT", compositeId, bpm, key, keyCamelot, lufsIntegrated, lufsPeak, dynamicRange, duration, sampleRate }
 *      or:  { type: "ERROR",  compositeId, error: string }
 *
 * Supported formats: WAV (fast path), MP3, FLAC, AIFF, OGG, M4A/AAC, OPUS (via audio-decode).
 * Duration is computed via mediabunny (pure-TS demuxer, no WebCodecs needed).
 */

import audioDecode from "audio-decode";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { detectBpm } from "./bpmDetection";
import { detectKey } from "./keyDetection";
import { measureLufs } from "./lufs";
import { parseWavChunks, readUint16LE, readUint32LE } from "./wavUtils";

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

// ─── Multi-format decoder ─────────────────────────────────────────────────────

/**
 * Decodes any supported audio format to mono PCM + sample rate.
 *
 * Fast path: WAV and AIFF/AIF use the hand-rolled PCM decoder (zero WASM overhead).
 * Fallback: audio-decode handles MP3, FLAC, OGG, M4A, AAC, OPUS, and non-PCM WAVs.
 *
 * Exported for unit testing.
 */
export async function decodeAudio(buffer: ArrayBuffer, path: string): Promise<WavData | null> {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "wav" || ext === "aif" || ext === "aiff") {
    const result = decodeWav(buffer);
    if (result) return result;
    // Fall through to audio-decode for non-PCM WAV (e.g. ADPCM, float extensible)
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
