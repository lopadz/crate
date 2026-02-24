import { describe, expect, test } from "vitest";
import { detectBpm } from "./bpmDetection";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SR = 44100;

/** Synthesize a click-track pulse train at a given BPM and duration. */
function pulseTrain(bpm: number, durationSec: number, sampleRate = SR): Float32Array {
  const samples = new Float32Array(Math.round(sampleRate * durationSec));
  const periodSamples = (60 / bpm) * sampleRate;
  for (let beat = 0; beat * periodSamples < samples.length; beat++) {
    const onset = Math.round(beat * periodSamples);
    if (onset < samples.length) samples[onset] = 1.0;
  }
  return samples;
}

/** Synthesize a loud pulse with brief decay (more realistic onset). */
function decayPulse(bpm: number, durationSec: number, sampleRate = SR): Float32Array {
  const samples = new Float32Array(Math.round(sampleRate * durationSec));
  const periodSamples = (60 / bpm) * sampleRate;
  const decayLen = Math.round(sampleRate * 0.05); // 50ms decay
  for (let beat = 0; beat * periodSamples < samples.length; beat++) {
    const onset = Math.round(beat * periodSamples);
    for (let i = 0; i < decayLen && onset + i < samples.length; i++) {
      samples[onset + i] += Math.exp(-i / (decayLen / 5));
    }
  }
  return samples;
}

/** White noise. */
function noise(durationSec: number, sampleRate = SR): Float32Array {
  const n = Math.round(sampleRate * durationSec);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = Math.random() * 2 - 1;
  return samples;
}

/** Silence. */
function silence(durationSec: number, sampleRate = SR): Float32Array {
  return new Float32Array(Math.round(sampleRate * durationSec));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("detectBpm — edge cases", () => {
  test("empty array returns null", () => {
    expect(detectBpm(new Float32Array(0), SR)).toBeNull();
  });

  test("silence returns null", () => {
    expect(detectBpm(silence(5), SR)).toBeNull();
  });

  test("pure noise returns null or a value (does not throw)", () => {
    // Noise may produce an arbitrary BPM or null — just must not throw
    expect(() => detectBpm(noise(5), SR)).not.toThrow();
  });

  test("audio shorter than 2 seconds returns null", () => {
    expect(detectBpm(pulseTrain(120, 1.5), SR)).toBeNull();
  });
});

describe("detectBpm — accuracy within ±5%", () => {
  function withinTolerance(detected: number | null, expected: number, pct = 5): boolean {
    if (detected === null) return false;
    const diff = Math.abs(detected - expected) / expected;
    return diff <= pct / 100;
  }

  test("detects 120 BPM pulse train", () => {
    const result = detectBpm(pulseTrain(120, 10), SR);
    expect(withinTolerance(result, 120)).toBe(true);
  });

  test("detects 90 BPM pulse train", () => {
    const result = detectBpm(pulseTrain(90, 10), SR);
    expect(withinTolerance(result, 90)).toBe(true);
  });

  test("detects 140 BPM pulse train", () => {
    const result = detectBpm(pulseTrain(140, 10), SR);
    expect(withinTolerance(result, 140)).toBe(true);
  });

  test("detects 120 BPM with decay pulses (more realistic)", () => {
    const result = detectBpm(decayPulse(120, 10), SR);
    expect(withinTolerance(result, 120)).toBe(true);
  });

  test("detects 128 BPM (common dance music tempo)", () => {
    const result = detectBpm(pulseTrain(128, 10), SR);
    expect(withinTolerance(result, 128)).toBe(true);
  });

  test("works at 48000 Hz sample rate", () => {
    const result = detectBpm(pulseTrain(120, 10, 48000), 48000);
    expect(withinTolerance(result, 120)).toBe(true);
  });
});
