/**
 * ITU-R BS.1770-4 loudness measurement (LUFS / LKFS).
 *
 * Algorithm:
 *   1. Apply K-weighting filter (pre-filter high-shelf + RLB high-pass)
 *   2. Compute mean-square energy for 400ms blocks (100ms step, 75% overlap)
 *   3. Absolute gate: discard blocks below −70 LUFS
 *   4. Relative gate: discard blocks 10 LU below the mean of gated blocks
 *   5. Integrated loudness = −0.691 + 10·log₁₀(mean of remaining blocks)
 *
 * Filter coefficients are computed analytically via bilinear transform for
 * any sample rate, matching the reference coefficients in BS.1770-4 Annex 1.
 */

export interface LufsResult {
  /** Integrated loudness in LUFS. −Infinity when all blocks are below the gate. */
  integrated: number;
  /** True peak amplitude (linear, 1.0 = 0 dBTP). Approximated via linear interpolation. */
  truePeak: number;
  /** Simplified loudness range in LU (≥ 0). 0 for silence or uniform signals. */
  dynamicRange: number;
}

// ─── K-weighting filter design parameters ────────────────────────────────────
// From BS.1770-4 Annex 1, derived by reverse-engineering the bilinear transform
// of the analog prototype filters.

const PRE_F0 = 1681.974450955533; // high-shelf center frequency (Hz)
const PRE_G = 3.999843853973347; // high-shelf gain (dB)
const PRE_Q = 0.7071752369554196; // quality factor
const PRE_VB_EXP = 0.4996667741545416; // intermediate Vb exponent

const RLB_F0 = 38.13547087602444; // high-pass cutoff (Hz)
const RLB_Q = 0.5003270373238773; // quality factor

// ─── Filter coefficient computation ──────────────────────────────────────────

interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function preFilterCoeffs(sampleRate: number): BiquadCoeffs {
  const K = Math.tan((Math.PI * PRE_F0) / sampleRate);
  const Vh = 10 ** (PRE_G / 20);
  const Vb = Vh ** PRE_VB_EXP;
  const a0 = 1 + K / PRE_Q + K * K;
  return {
    b0: (Vh + Vb * (K / PRE_Q) + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - Vb * (K / PRE_Q) + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / PRE_Q + K * K) / a0,
  };
}

function rlbFilterCoeffs(sampleRate: number): BiquadCoeffs {
  const K = Math.tan((Math.PI * RLB_F0) / sampleRate);
  const a0 = 1 + K / RLB_Q + K * K;
  return {
    b0: 1 / a0,
    b1: -2 / a0,
    b2: 1 / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / RLB_Q + K * K) / a0,
  };
}

// ─── Biquad IIR filter ────────────────────────────────────────────────────────

function applyBiquad(input: Float32Array, c: BiquadCoeffs): Float32Array {
  const out = new Float32Array(input.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

function applyKWeighting(samples: Float32Array, sampleRate: number): Float32Array {
  return applyBiquad(
    applyBiquad(samples, preFilterCoeffs(sampleRate)),
    rlbFilterCoeffs(sampleRate),
  );
}

// ─── True peak (linear interpolation approximation) ──────────────────────────

function computeTruePeak(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
    // Linear interpolation between adjacent samples for inter-sample peaks
    if (i < samples.length - 1) {
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const interp = Math.abs(samples[i] * (1 - t) + samples[i + 1] * t);
        if (interp > peak) peak = interp;
      }
    }
  }
  return peak;
}

// ─── Main measurement ─────────────────────────────────────────────────────────

export function measureLufs(samples: Float32Array, sampleRate: number): LufsResult {
  const silence: LufsResult = {
    integrated: -Infinity,
    truePeak: 0,
    dynamicRange: 0,
  };

  if (samples.length === 0) return silence;

  const weighted = applyKWeighting(samples, sampleRate);

  // 400ms blocks with 100ms step (75% overlap per BS.1770-4)
  const blockSize = Math.round(sampleRate * 0.4);
  const stepSize = Math.round(sampleRate * 0.1);

  const blockMeanSquares: number[] = [];
  for (let start = 0; start + blockSize <= weighted.length; start += stepSize) {
    let sum = 0;
    for (let i = start; i < start + blockSize; i++) {
      sum += weighted[i] * weighted[i];
    }
    blockMeanSquares.push(sum / blockSize);
  }

  if (blockMeanSquares.length === 0) return silence;

  // Absolute gate: L >= −70 LUFS  →  meanSquare >= 10^((−70 + 0.691) / 10)
  const absGateMs = 10 ** ((-70 + 0.691) / 10);
  const absGated = blockMeanSquares.filter((ms) => ms >= absGateMs);

  if (absGated.length === 0) {
    return { ...silence, truePeak: computeTruePeak(samples) };
  }

  // Relative gate: 10 LU below the mean of absolutely-gated blocks
  const absGatedMean = absGated.reduce((a, b) => a + b, 0) / absGated.length;
  const relGateMs = absGatedMean * 10 ** (-10 / 10);
  const relGated = absGated.filter((ms) => ms >= relGateMs);

  if (relGated.length === 0) {
    return { ...silence, truePeak: computeTruePeak(samples) };
  }

  const finalMean = relGated.reduce((a, b) => a + b, 0) / relGated.length;
  const integrated = -0.691 + 10 * Math.log10(finalMean);
  const truePeak = computeTruePeak(samples);

  // Simplified dynamic range: spread between loud (95th pct) and soft (10th pct) blocks
  let dynamicRange = 0;
  if (absGated.length >= 2) {
    const sorted = [...absGated].sort((a, b) => a - b);
    const softMs = sorted[Math.max(0, Math.floor(sorted.length * 0.1))];
    const loudMs = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const soft = -0.691 + 10 * Math.log10(softMs);
    const loud = -0.691 + 10 * Math.log10(loudMs);
    dynamicRange = Math.max(0, loud - soft);
  }

  return { integrated, truePeak, dynamicRange };
}
