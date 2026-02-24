/**
 * BPM detection via onset strength envelope + autocorrelation.
 *
 * Algorithm:
 *   1. Compute RMS energy over short frames (10ms, 50% overlap)
 *   2. Build onset strength function: positive half-wave rectified frame-to-frame energy delta
 *   3. Autocorrelate the onset envelope over the 60–200 BPM lag range
 *   4. Apply octave correction: if detected BPM < 105, the 2× lag (half tempo) may
 *      have won due to fractional-frame alignment; check the half-lag and prefer it
 *      when any real beats exist there
 *   5. Return rounded BPM, or null for silence / too-short audio
 */

const FRAME_MS = 10; // analysis frame duration (ms)
const HOP_FACTOR = 0.5; // 50% overlap → frame rate = 1000/(10*0.5) = 200 fps
const BPM_MIN = 60;
const BPM_MAX = 200;
const SILENCE_THRESHOLD = 1e-6; // mean-square energy below this → silent

export function detectBpm(samples: Float32Array, sampleRate: number): number | null {
  if (samples.length === 0) return null;

  const frameSamples = Math.round((FRAME_MS / 1000) * sampleRate);
  const hopSamples = Math.round(frameSamples * HOP_FACTOR);
  const framesPerSec = 1000 / (FRAME_MS * HOP_FACTOR);

  // ── 1. RMS energy per frame ───────────────────────────────────────────────
  const energyFrames: number[] = [];
  for (let start = 0; start + frameSamples <= samples.length; start += hopSamples) {
    let sum = 0;
    for (let i = start; i < start + frameSamples; i++) sum += samples[i] * samples[i];
    energyFrames.push(sum / frameSamples);
  }

  // Require at least 2 seconds of frames for reliable tempo detection
  if (energyFrames.length < framesPerSec * 2) return null;

  // Check for silence
  const meanEnergy = energyFrames.reduce((a, b) => a + b, 0) / energyFrames.length;
  if (meanEnergy < SILENCE_THRESHOLD) return null;

  // ── 2. Onset strength: positive flux ─────────────────────────────────────
  const n = energyFrames.length;
  const onset = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    const delta = energyFrames[i] - energyFrames[i - 1];
    onset[i] = delta > 0 ? delta : 0;
  }

  // ── 3. Autocorrelation over BPM lag range ─────────────────────────────────
  const lagMin = Math.round((60 / BPM_MAX) * framesPerSec);
  const lagMax = Math.round((60 / BPM_MIN) * framesPerSec);

  const corrValues = new Float32Array(lagMax - lagMin + 1);
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let corr = 0;
    const count = n - lag;
    for (let i = 0; i < count; i++) corr += onset[i] * onset[i + lag];
    corrValues[lag - lagMin] = corr / count;
  }

  let bestIdx = 0;
  for (let i = 1; i < corrValues.length; i++) {
    if (corrValues[i] > corrValues[bestIdx]) bestIdx = i;
  }
  let bestLag = bestIdx + lagMin;
  const bestCorr = corrValues[bestIdx];

  if (bestCorr === 0) return null;

  // ── 4. Octave correction ──────────────────────────────────────────────────
  // When the beat period in frames is approximately N+0.5, consecutive beat gaps
  // alternate between N and N+1. The 2× lag (N + (N+1) = 2N+1) then captures
  // every beat-pair and may score higher than the fundamental. If the detected
  // BPM looks like a half-tempo candidate, check both floor/ceil of bestLag/2.
  const detectedBpm = (framesPerSec * 60) / bestLag;
  if (detectedBpm < 105) {
    let bestHalfLag = -1;
    let bestHalfCorr = 0;
    for (const halfLag of [Math.floor(bestLag / 2), Math.ceil(bestLag / 2)]) {
      if (halfLag < lagMin || halfLag > lagMax) continue;
      const c = corrValues[halfLag - lagMin];
      if (c > bestHalfCorr) {
        bestHalfCorr = c;
        bestHalfLag = halfLag;
      }
    }
    if (bestHalfLag >= 0 && bestHalfCorr > 0) bestLag = bestHalfLag;
  }

  // ── 5. Convert lag to BPM ─────────────────────────────────────────────────
  const bpm = (framesPerSec * 60) / bestLag;
  return Math.round(bpm * 10) / 10;
}
