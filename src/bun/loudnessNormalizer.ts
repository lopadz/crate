import * as fs from "node:fs";
import * as path from "node:path";
import type { createQueryHelpers } from "./db";
import type { OperationRecord } from "./fileOps";

export type NormalizeJob = {
  sourcePath: string;
  targetLufs: number;
  overwrite: boolean;
  outputDir?: string;
};

export type MediabunnyNormalizer = {
  normalize: (src: string, targetLufs: number) => Promise<ArrayBuffer>;
};

export async function normalizeFile(
  job: NormalizeJob,
  mediabunny: MediabunnyNormalizer,
): Promise<string> {
  const buf = await mediabunny.normalize(job.sourcePath, job.targetLufs);
  if (job.overwrite) {
    fs.writeFileSync(job.sourcePath, new Uint8Array(buf));
    return job.sourcePath;
  }
  const outDir = job.outputDir ?? path.dirname(job.sourcePath);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, path.basename(job.sourcePath));
  fs.writeFileSync(outPath, new Uint8Array(buf));
  return outPath;
}

export async function batchNormalize(
  jobs: NormalizeJob[],
  mediabunny: MediabunnyNormalizer,
  db: ReturnType<typeof createQueryHelpers>,
  onProgress?: (done: number, total: number) => void,
): Promise<OperationRecord> {
  const entries: { originalPath: string; newPath: string }[] = [];
  for (let i = 0; i < jobs.length; i++) {
    const outPath = await normalizeFile(jobs[i], mediabunny);
    entries.push({ originalPath: jobs[i].sourcePath, newPath: outPath });
    onProgress?.(i + 1, jobs.length);
  }
  const timestamp = Date.now();
  const id = db.logOperation({ operation: "normalize", filesJson: JSON.stringify(entries) });
  return { id, operation: "normalize", files: entries, timestamp, rolledBackAt: null };
}
