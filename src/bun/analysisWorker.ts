/**
 * Bun Worker thread: decodes an audio file to PCM and runs analysis.
 *
 * Receives: { type: "ANALYZE", fileId: number, path: string }
 * Posts:    { type: "RESULT", compositeId, bpm, key, keyCamelot, lufsIntegrated, lufsPeak, dynamicRange }
 *      or:  { type: "ERROR",  compositeId, error: string }
 *
 * Supported formats: PCM WAV (16-bit, 24-bit, 32-bit float).
 * Non-WAV files receive null analysis values (no error).
 */

import { detectBpm } from "./bpmDetection";
import { detectKey } from "./keyDetection";
import { measureLufs } from "./lufs";
import { parseWavChunks, readUint16LE, readUint32LE } from "./wavUtils";

// ─── WAV decoder ──────────────────────────────────────────────────────────────

interface WavData {
  mono: Float32Array;
  sampleRate: number;
}

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
      // For extensible format, real format is in the extension
      if (fmtTag === 65534 && chunk.size >= 18) {
        fmtTag = readUint16LE(buf, chunk.offset + 16); // sub-format GUID low bytes
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

// ─── Worker message handler ───────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent) => {
  const { compositeId, path } = event.data as {
    compositeId: string;
    path: string;
  };

  try {
    const buffer = await Bun.file(path).arrayBuffer();
    const wav = decodeWav(buffer);

    if (!wav) {
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
      });
      return;
    }

    const { mono, sampleRate } = wav;
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
    });
  } catch (err) {
    self.postMessage({
      type: "ERROR",
      compositeId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
