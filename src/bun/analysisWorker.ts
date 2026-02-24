/**
 * Bun Worker thread: decodes an audio file to PCM and runs analysis.
 *
 * Receives: { type: "ANALYZE", fileId: number, path: string }
 * Posts:    { type: "RESULT", fileId, bpm, key, keyCamelot, lufsIntegrated, lufsPeak, dynamicRange }
 *      or:  { type: "ERROR",  fileId, error: string }
 *
 * Supported formats: PCM WAV (16-bit, 24-bit, 32-bit float).
 * Non-WAV files receive null analysis values (no error).
 */

import { detectBpm } from "./bpmDetection";
import { detectKey } from "./keyDetection";
import { measureLufs } from "./lufs";

// ─── WAV decoder ──────────────────────────────────────────────────────────────

interface WavData {
  mono: Float32Array;
  sampleRate: number;
}

function r16(buf: Uint8Array, o: number): number {
  return buf[o] | (buf[o + 1] << 8);
}
function r32(buf: Uint8Array, o: number): number {
  return (
    (buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)) >>> 0
  );
}

function decodeWav(buffer: ArrayBuffer): WavData | null {
  const buf = new Uint8Array(buffer);

  // RIFF/WAVE magic
  if (
    buf[0] !== 0x52 ||
    buf[1] !== 0x49 ||
    buf[2] !== 0x46 ||
    buf[3] !== 0x46 || // RIFF
    buf[8] !== 0x57 ||
    buf[9] !== 0x41 ||
    buf[10] !== 0x56 ||
    buf[11] !== 0x45 // WAVE
  )
    return null;

  let fmtTag = 0,
    channels = 0,
    sampleRate = 0,
    bitDepth = 0;
  let dataOffset = -1,
    dataSize = -1;

  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = String.fromCharCode(
      buf[offset],
      buf[offset + 1],
      buf[offset + 2],
      buf[offset + 3],
    );
    const size = r32(buf, offset + 4);
    offset += 8;

    if (id === "fmt ") {
      fmtTag = r16(buf, offset); // 1=PCM, 3=IEEE float, 65534=extensible
      channels = r16(buf, offset + 2);
      sampleRate = r32(buf, offset + 4);
      bitDepth = r16(buf, offset + 14);
      // For extensible format, real format is in the extension
      if (fmtTag === 65534 && size >= 18) {
        fmtTag = r16(buf, offset + 16); // sub-format GUID low bytes
      }
    } else if (id === "data") {
      dataOffset = offset;
      dataSize = size;
    }

    offset += size + (size & 1); // word-align
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
  const { fileId, path } = event.data as { fileId: number; path: string };

  try {
    const buffer = await Bun.file(path).arrayBuffer();
    const wav = decodeWav(buffer);

    if (!wav) {
      // Unsupported format — return empty analysis rather than error
      self.postMessage({
        type: "RESULT",
        fileId,
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
      fileId,
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
      fileId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
