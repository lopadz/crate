import { describe, expect, mock, test } from "bun:test";

// ── audio-decode mock (must be called before importing analysisWorker) ─────────
//
// Simulates a successful decode of any non-WAV format.
// Returns 1 second of stereo silence at 44100 Hz.
mock.module("audio-decode", () => ({
  // biome-ignore lint/complexity/useArrowFunction: named function for clarity in mock
  default: async function (_buf: ArrayBuffer) {
    const ch0 = new Float32Array(44100);
    const ch1 = new Float32Array(44100);
    return {
      sampleRate: 44100,
      numberOfChannels: 2,
      getChannelData: (i: number) => (i === 0 ? ch0 : ch1),
    };
  },
}));

// ── Import under test (after mock is registered) ──────────────────────────────
import { decodeAudio } from "./analysisWorker";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Builds a minimal valid PCM WAV ArrayBuffer containing a 440 Hz sine wave.
 * @param channels 1 = mono, 2 = stereo
 * @param durationSeconds duration of audio
 */
function makeSineWav(durationSeconds = 1, channels = 1, sampleRate = 44100): ArrayBuffer {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const dataSize = numSamples * channels * 2; // 16-bit PCM
  const total = 44 + dataSize;
  const buf = new ArrayBuffer(total);
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  // RIFF header
  bytes[0] = 0x52;
  bytes[1] = 0x49;
  bytes[2] = 0x46;
  bytes[3] = 0x46;
  view.setUint32(4, total - 8, true);
  bytes[8] = 0x57;
  bytes[9] = 0x41;
  bytes[10] = 0x56;
  bytes[11] = 0x45;
  // fmt  chunk
  bytes[12] = 0x66;
  bytes[13] = 0x6d;
  bytes[14] = 0x74;
  bytes[15] = 0x20;
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  // data chunk
  bytes[36] = 0x64;
  bytes[37] = 0x61;
  bytes[38] = 0x74;
  bytes[39] = 0x61;
  view.setUint32(40, dataSize, true);
  // PCM: 440 Hz sine wave
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 32767);
    for (let ch = 0; ch < channels; ch++) {
      view.setInt16(44 + (i * channels + ch) * 2, sample, true);
    }
  }
  return buf;
}

/**
 * Builds a WAV file with WAVE_FORMAT_EXTENSIBLE (fmtTag=0xFFFE).
 * This is the format used by Logic Pro, ProTools, and other DAWs for stems.
 *
 * Extensible fmt chunk layout (40 bytes of data):
 *  0-1   audioFormat       = 0xFFFE
 *  2-3   numChannels
 *  4-7   sampleRate
 *  8-11  byteRate
 *  12-13 blockAlign
 *  14-15 bitsPerSample
 *  16-17 cbSize            = 22
 *  18-19 validBitsPerSample
 *  20-23 channelMask
 *  24-25 SubFormat low bytes (1 = PCM, 3 = IEEE float)
 *  26-39 rest of SubFormat GUID
 */
function makeExtensibleWav(
  durationSeconds = 1,
  channels = 2,
  sampleRate = 44100,
  subFormat: 1 | 3 = 1, // 1=PCM, 3=float
): ArrayBuffer {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const bytesPerSample = 3; // 24-bit PCM — common for professional stems
  const dataSize = numSamples * channels * bytesPerSample;
  const fmtSize = 40; // extensible fmt is always 40 bytes
  const total = 12 + 8 + fmtSize + 8 + dataSize;
  const buf = new ArrayBuffer(total);
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  // RIFF header
  bytes.set([0x52, 0x49, 0x46, 0x46]); // "RIFF"
  view.setUint32(4, total - 8, true);
  bytes.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

  // fmt  chunk header
  bytes.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  view.setUint32(16, fmtSize, true);

  const fmtBase = 20; // first byte of fmt chunk data
  view.setUint16(fmtBase + 0, 0xfffe, true); // audioFormat = extensible
  view.setUint16(fmtBase + 2, channels, true);
  view.setUint32(fmtBase + 4, sampleRate, true);
  view.setUint32(fmtBase + 8, sampleRate * channels * bytesPerSample, true); // byteRate
  view.setUint16(fmtBase + 12, channels * bytesPerSample, true); // blockAlign
  view.setUint16(fmtBase + 14, 24, true); // bitsPerSample
  view.setUint16(fmtBase + 16, 22, true); // cbSize
  view.setUint16(fmtBase + 18, 24, true); // validBitsPerSample
  view.setUint32(fmtBase + 20, 0, true); // channelMask (0 = default)
  // SubFormat GUID: first 2 bytes = subFormat (1=PCM, 3=float), rest = standard Microsoft GUID
  view.setUint16(fmtBase + 24, subFormat, true);
  bytes.set([0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71], fmtBase + 26);

  // data chunk
  const dataChunkStart = fmtBase + fmtSize;
  bytes.set([0x64, 0x61, 0x74, 0x61], dataChunkStart); // "data"
  view.setUint32(dataChunkStart + 4, dataSize, true);

  // 440 Hz sine wave, 24-bit PCM
  const dataStart = dataChunkStart + 8;
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8388607);
    const clamped = Math.max(-8388608, Math.min(8388607, sample));
    for (let ch = 0; ch < channels; ch++) {
      const pos = dataStart + (i * channels + ch) * 3;
      bytes[pos] = clamped & 0xff;
      bytes[pos + 1] = (clamped >> 8) & 0xff;
      bytes[pos + 2] = (clamped >> 16) & 0xff;
    }
  }

  return buf;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("decodeAudio", () => {
  test("WAV file uses fast path and returns non-null PCM data", async () => {
    const buf = makeSineWav(1, 1);
    const result = await decodeAudio(buf, "test.wav");
    expect(result).not.toBeNull();
    expect(result?.sampleRate).toBe(44100);
    expect(result?.mono.length).toBe(44100);
  });

  test("MP3 file falls through to audio-decode and returns non-null data", async () => {
    const buf = new ArrayBuffer(100); // dummy bytes — audio-decode is mocked
    const result = await decodeAudio(buf, "kick.mp3");
    expect(result).not.toBeNull();
    expect(result?.sampleRate).toBe(44100);
  });

  test("FLAC file falls through to audio-decode and returns non-null data", async () => {
    const buf = new ArrayBuffer(100);
    const result = await decodeAudio(buf, "kick.flac");
    expect(result).not.toBeNull();
  });

  test("AIFF file tries fast path then falls through to audio-decode", async () => {
    // An AIFF buffer fails decodeWav (not RIFF/WAVE), so falls to audio-decode
    const buf = new ArrayBuffer(100);
    const result = await decodeAudio(buf, "kick.aiff");
    expect(result).not.toBeNull();
  });

  test("unrecognized binary with .wav extension returns null without throwing", async () => {
    // Not a valid WAV, audio-decode also fails — should return null
    mock.module("audio-decode", () => ({
      // biome-ignore lint/complexity/useArrowFunction: named function for clarity in mock
      default: async function (_buf: ArrayBuffer) {
        throw new Error("Unsupported format");
      },
    }));
    // Re-import to get updated mock — use a fresh function call
    const buf = new ArrayBuffer(12); // not a valid WAV header
    // The WAV fast path returns null; audio-decode throws → overall null
    const result = await decodeAudio(buf, "fake.wav");
    expect(result).toBeNull();
  });

  test("extensible WAV (fmtTag=0xFFFE, 24-bit PCM sub-format) decodes correctly", async () => {
    const buf = makeExtensibleWav(1, 2, 44100, 1); // 1s stereo 24-bit extensible WAV
    const result = await decodeAudio(buf, "stems.wav");
    expect(result).not.toBeNull();
    expect(result?.sampleRate).toBe(44100);
    expect(result?.mono.length).toBe(44100); // 1 second at 44100 Hz
  });

  test("stereo WAV produces mono result with correct length", async () => {
    const channels = 2;
    const sampleRate = 44100;
    const buf = makeSineWav(1, channels, sampleRate);
    const result = await decodeAudio(buf, "stereo.wav");
    expect(result).not.toBeNull();
    // mono length should equal numSamples (not numSamples * channels)
    expect(result?.mono.length).toBe(sampleRate);
  });
});
