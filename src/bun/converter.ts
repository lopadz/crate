import * as fs from "node:fs";
import * as path from "node:path";

export type ConversionPreset = {
  id: string;
  label: string;
  format: "wav" | "flac" | "aiff" | "mp3" | "ogg";
  sampleRate: number;
  bitDepth: 16 | 24 | 32;
  bitrate?: number;
};

export type MediabunnyAdapter = {
  convert: (src: string, opts: ConversionPreset) => Promise<ArrayBuffer>;
};

type ConversionJob = {
  sourcePath: string;
  outputDir: string;
  preset: ConversionPreset;
};

export const PRESETS: ConversionPreset[] = [
  { id: "daw", label: "DAW (WAV 24-bit)", format: "wav", sampleRate: 44100, bitDepth: 24 },
  {
    id: "share",
    label: "Share (MP3 320)",
    format: "mp3",
    sampleRate: 44100,
    bitDepth: 16,
    bitrate: 320,
  },
  {
    id: "archive",
    label: "Archive (FLAC 24-bit)",
    format: "flac",
    sampleRate: 44100,
    bitDepth: 24,
  },
];

export async function convertFile(
  job: ConversionJob,
  mediabunny: MediabunnyAdapter,
): Promise<string> {
  const buf = await mediabunny.convert(job.sourcePath, job.preset);
  const base = path.basename(job.sourcePath, path.extname(job.sourcePath));
  const outPath = path.join(job.outputDir, `${base}.${job.preset.format}`);
  fs.writeFileSync(outPath, new Uint8Array(buf));
  return outPath;
}

export async function batchConvert(
  jobs: ConversionJob[],
  mediabunny: MediabunnyAdapter,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < jobs.length; i++) {
    results.push(await convertFile(jobs[i], mediabunny));
    onProgress?.(i + 1, jobs.length);
  }
  return results;
}
