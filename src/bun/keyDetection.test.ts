import { describe, expect, test } from "vitest";
import { CAMELOT, detectKey } from "./keyDetection";

const SR = 44100;

/** Synthesize a chord: sum of sine waves at given frequencies. */
function chord(freqs: number[], durationSec: number, sampleRate = SR): Float32Array {
  const n = Math.round(sampleRate * durationSec);
  const samples = new Float32Array(n);
  for (const f of freqs) {
    for (let i = 0; i < n; i++) {
      samples[i] += Math.sin((2 * Math.PI * f * i) / sampleRate);
    }
  }
  return samples;
}

function silence(durationSec: number, sampleRate = SR): Float32Array {
  return new Float32Array(Math.round(sampleRate * durationSec));
}

// ─── Triad helpers ─────────────────────────────────────────────────────────
// Each triad includes 2 octaves per note for a stronger chromagram.

const AM = chord([220, 440, 880, 261.63, 523.25, 329.63, 659.26], 5); // A C E
const C_MAJ = chord([130.81, 261.63, 523.25, 329.63, 659.26, 392.0, 784.0], 5); // C E G
const G_MAJ = chord([196.0, 392.0, 784.0, 246.94, 493.88, 293.66, 587.33], 5); // G B D
const DM = chord([146.83, 293.66, 587.33, 174.61, 349.23, 220.0, 440.0], 5); // D F A

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe("detectKey — edge cases", () => {
  test("empty array returns null", () => {
    expect(detectKey(new Float32Array(0), SR)).toBeNull();
  });

  test("silence returns null", () => {
    expect(detectKey(silence(5), SR)).toBeNull();
  });

  test("signal shorter than 2 seconds returns null", () => {
    expect(detectKey(chord([440, 523.25, 659.26], 1.5), SR)).toBeNull();
  });
});

// ─── Key detection accuracy ─────────────────────────────────────────────────

describe("detectKey — accuracy", () => {
  test("A minor triad (A, C, E) → Am, 8A", () => {
    const result = detectKey(AM, SR);
    expect(result?.key).toBe("Am");
    expect(result?.camelot).toBe("8A");
  });

  test("C major triad (C, E, G) → C, 8B", () => {
    const result = detectKey(C_MAJ, SR);
    expect(result?.key).toBe("C");
    expect(result?.camelot).toBe("8B");
  });

  test("G major triad (G, B, D) → G, 9B", () => {
    const result = detectKey(G_MAJ, SR);
    expect(result?.key).toBe("G");
    expect(result?.camelot).toBe("9B");
  });

  test("D minor triad (D, F, A) → Dm, 7A", () => {
    const result = detectKey(DM, SR);
    expect(result?.key).toBe("Dm");
    expect(result?.camelot).toBe("7A");
  });

  test("works at 48000 Hz sample rate", () => {
    const samples = chord([440, 261.63, 329.63, 220, 523.25, 659.26], 5, 48000);
    const result = detectKey(samples, 48000);
    expect(result?.key).toBe("Am");
    expect(result?.camelot).toBe("8A");
  });
});

// ─── Camelot mapping completeness ────────────────────────────────────────────

describe("detectKey — Camelot mapping", () => {
  const EXPECTED_CAMELOT: Record<string, string> = {
    // Major keys (B = major)
    C: "8B",
    G: "9B",
    D: "10B",
    A: "11B",
    E: "12B",
    B: "1B",
    "F#": "2B",
    "C#": "3B",
    "G#": "4B",
    "D#": "5B",
    "A#": "6B",
    F: "7B",
    // Minor keys (A = minor)
    Am: "8A",
    Em: "9A",
    Bm: "10A",
    "F#m": "11A",
    "C#m": "12A",
    "G#m": "1A",
    "D#m": "2A",
    "A#m": "3A",
    Fm: "4A",
    Cm: "5A",
    Gm: "6A",
    Dm: "7A",
  };

  test("CAMELOT export contains all 24 keys with correct codes", () => {
    for (const [key, expected] of Object.entries(EXPECTED_CAMELOT)) {
      expect(CAMELOT[key], `key: ${key}`).toBe(expected);
    }
    expect(Object.keys(CAMELOT)).toHaveLength(24);
  });
});
