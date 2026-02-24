/**
 * Musical key detection via chromagram + Krumhansl-Schmuckler profile correlation.
 *
 * Algorithm:
 *   1. Frame the signal (4096 samples, 2048 hop, Hann window)
 *   2. FFT → map magnitude bins to 12 pitch classes (chroma)
 *   3. Accumulate chroma across all frames
 *   4. Pearson-correlate against K-S major and minor templates for all 12 roots
 *   5. Return the key with highest correlation, plus its Camelot wheel code
 *
 * Pitch class convention: 0 = C, 1 = C#, 2 = D, …, 11 = B (sharps throughout).
 */

// ─── Krumhansl-Schmuckler profiles ───────────────────────────────────────────
// Root is at index 0; rotate by pitch class to match any key.

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// ─── Key name tables (indexed by pitch class 0–11) ────────────────────────────
const MAJOR_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MINOR_NAMES = ["Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm"];

// ─── Camelot wheel ────────────────────────────────────────────────────────────
export const CAMELOT: Record<string, string> = {
  // Major (B = major)
  C: "8B", G: "9B", D: "10B", A: "11B", E: "12B", B: "1B",
  "F#": "2B", "C#": "3B", "G#": "4B", "D#": "5B", "A#": "6B", F: "7B",
  // Minor (A = minor)
  Am: "8A", Em: "9A", Bm: "10A", "F#m": "11A", "C#m": "12A", "G#m": "1A",
  "D#m": "2A", "A#m": "3A", Fm: "4A", Cm: "5A", Gm: "6A", Dm: "7A",
};

export interface KeyResult {
  key: string;
  camelot: string;
}

// ─── FFT (Cooley-Tukey, power-of-2 in-place) ─────────────────────────────────

const FFT_SIZE = 4096;
const HOP_SIZE = FFT_SIZE >>> 1;
const SILENCE_THRESHOLD = 1e-6;
const CHROMA_FREQ_MIN = 80;
const CHROMA_FREQ_MAX = 4000;

// Precomputed Hann window
const HANN = new Float64Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) {
  HANN[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
}

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  // Butterfly passes
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + half] * curRe - im[i + k + half] * curIm;
        const vIm = re[i + k + half] * curIm + im[i + k + half] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + half] = uRe - vRe;
        im[i + k + half] = uIm - vIm;
        const nr = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nr;
      }
    }
  }
}

// ─── Chromagram ───────────────────────────────────────────────────────────────

function computeChroma(samples: Float32Array, sampleRate: number): Float64Array {
  const chroma = new Float64Array(12);
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);

  for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP_SIZE) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = samples[start + i] * HANN[i];
      im[i] = 0;
    }
    fft(re, im);

    const binWidth = sampleRate / FFT_SIZE;
    for (let bin = 1; bin < FFT_SIZE >> 1; bin++) {
      const freq = bin * binWidth;
      if (freq < CHROMA_FREQ_MIN || freq > CHROMA_FREQ_MAX) continue;
      // Map frequency to pitch class: C=0 … B=11
      const pc = (((Math.round(12 * Math.log2(freq / 16.3516))) % 12) + 12) % 12;
      chroma[pc] += Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
    }
  }
  return chroma;
}

// ─── Pearson correlation ──────────────────────────────────────────────────────

function pearson(x: Float64Array, template: number[]): number {
  const n = x.length;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += template[i];
  }
  const mx = sumX / n;
  const my = sumY / n;
  let num = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = template[i] - my;
    num += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  const denom = Math.sqrt(varX * varY);
  return denom < 1e-15 ? 0 : num / denom;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function detectKey(samples: Float32Array, sampleRate: number): KeyResult | null {
  if (samples.length === 0) return null;

  // Silence check
  let energy = 0;
  for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
  if (energy / samples.length < SILENCE_THRESHOLD) return null;

  // Minimum 2 seconds for reliable detection
  if (samples.length < sampleRate * 2) return null;

  const chroma = computeChroma(samples, sampleRate);

  // Verify chroma has signal
  let chromaSum = 0;
  for (let i = 0; i < 12; i++) chromaSum += chroma[i];
  if (chromaSum < 1e-10) return null;

  // Correlate against all 24 key templates
  let bestCorr = -Infinity;
  let bestKey = "C";

  for (let root = 0; root < 12; root++) {
    const majorTpl = MAJOR_PROFILE.map((_, j) => MAJOR_PROFILE[(j - root + 12) % 12]);
    const majorCorr = pearson(chroma, majorTpl);
    if (majorCorr > bestCorr) {
      bestCorr = majorCorr;
      bestKey = MAJOR_NAMES[root];
    }

    const minorTpl = MINOR_PROFILE.map((_, j) => MINOR_PROFILE[(j - root + 12) % 12]);
    const minorCorr = pearson(chroma, minorTpl);
    if (minorCorr > bestCorr) {
      bestCorr = minorCorr;
      bestKey = MINOR_NAMES[root];
    }
  }

  const camelot = CAMELOT[bestKey];
  return camelot ? { key: bestKey, camelot } : null;
}
