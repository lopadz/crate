import * as fs from "node:fs";
import * as path from "node:path";

export type TrimJob = {
  sourcePath: string;
  thresholdDb: number;
  outputDir: string;
};

export type MediabunnyTrimmer = {
  trim: (src: string, thresholdDb: number) => Promise<ArrayBuffer>;
};

export async function trimSilence(job: TrimJob, mediabunny: MediabunnyTrimmer): Promise<string> {
  const buf = await mediabunny.trim(job.sourcePath, job.thresholdDb);
  fs.mkdirSync(job.outputDir, { recursive: true });
  const outPath = path.join(job.outputDir, path.basename(job.sourcePath));
  fs.writeFileSync(outPath, new Uint8Array(buf));
  return outPath;
}
