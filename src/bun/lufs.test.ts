import { describe, expect, test } from "bun:test";
import { measureLufs } from "./lufs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateSine(
  freq: number,
  amplitude: number,
  sampleRate: number,
  durationSec: number,
): Float32Array {
  const n = Math.floor(sampleRate * durationSec);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    buf[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buf;
}

// ─── measureLufs ─────────────────────────────────────────────────────────────

describe("measureLufs — edge cases", () => {
  test("empty array does not throw and returns -Infinity", () => {
    const result = measureLufs(new Float32Array(0), 44100);
    expect(result.integrated).toBe(-Infinity);
  });

  test("silence returns -Infinity integrated LUFS", () => {
    const silence = new Float32Array(44100 * 3); // 3 s of zeros
    const result = measureLufs(silence, 44100);
    expect(result.integrated).toBe(-Infinity);
  });

  test("signal shorter than one 400ms block returns -Infinity", () => {
    // 200ms — not enough for a complete block
    const short = generateSine(1000, 0.5, 44100, 0.2);
    const result = measureLufs(short, 44100);
    expect(result.integrated).toBe(-Infinity);
  });
});

describe("measureLufs — loudness measurement", () => {
  test("louder signal produces higher integrated LUFS than quieter signal", () => {
    const loud = generateSine(1000, 0.8, 44100, 3);
    const quiet = generateSine(1000, 0.1, 44100, 3);
    const loudResult = measureLufs(loud, 44100);
    const quietResult = measureLufs(quiet, 44100);
    expect(loudResult.integrated).toBeGreaterThan(quietResult.integrated);
  });

  test("1 kHz sine at amplitude 0.28 produces approximately −14 LUFS (±2 LU)", () => {
    // At 44100 Hz with K-weighting, a 1 kHz sine at amplitude ≈ 0.28 should land
    // around −14 LUFS. Allow ±2 LU for filter coefficient rounding.
    const sine = generateSine(1000, 0.28, 44100, 3);
    const result = measureLufs(sine, 44100);
    expect(result.integrated).toBeGreaterThan(-16);
    expect(result.integrated).toBeLessThan(-12);
  });

  test("doubling amplitude raises LUFS by approximately 6 LU", () => {
    const a = generateSine(1000, 0.2, 44100, 3);
    const b = generateSine(1000, 0.4, 44100, 3);
    const diff = measureLufs(b, 44100).integrated - measureLufs(a, 44100).integrated;
    expect(diff).toBeGreaterThan(5.5);
    expect(diff).toBeLessThan(6.5);
  });

  test("works at 48000 Hz sample rate", () => {
    const sine = generateSine(1000, 0.28, 48000, 3);
    const result = measureLufs(sine, 48000);
    expect(result.integrated).toBeGreaterThan(-16);
    expect(result.integrated).toBeLessThan(-12);
  });
});

describe("measureLufs — true peak", () => {
  test("truePeak is positive for a non-silent signal", () => {
    const sine = generateSine(1000, 0.5, 44100, 1);
    const { truePeak } = measureLufs(sine, 44100);
    expect(truePeak).toBeGreaterThan(0);
  });

  test("truePeak does not exceed 1.2 for a 0.5-amplitude signal (< 0 dBTP)", () => {
    const sine = generateSine(1000, 0.5, 44100, 1);
    const { truePeak } = measureLufs(sine, 44100);
    expect(truePeak).toBeLessThan(1.2);
  });

  test("higher amplitude signal has higher truePeak", () => {
    const loud = generateSine(1000, 0.9, 44100, 1);
    const quiet = generateSine(1000, 0.3, 44100, 1);
    expect(measureLufs(loud, 44100).truePeak).toBeGreaterThan(measureLufs(quiet, 44100).truePeak);
  });
});

describe("measureLufs — dynamic range", () => {
  test("dynamicRange is non-negative for a uniform sine wave", () => {
    const sine = generateSine(1000, 0.5, 44100, 3);
    const { dynamicRange } = measureLufs(sine, 44100);
    expect(dynamicRange).toBeGreaterThanOrEqual(0);
  });

  test("silence returns dynamicRange of 0", () => {
    const silence = new Float32Array(44100 * 3);
    const { dynamicRange } = measureLufs(silence, 44100);
    expect(dynamicRange).toBe(0);
  });
});
