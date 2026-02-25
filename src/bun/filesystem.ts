import type { Dirent } from "node:fs";
import { watch } from "node:fs";
import { readdir as fsReaddir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import type { AudioFile } from "../shared/types";

export const AUDIO_EXTENSIONS = new Set([
  ".wav",
  ".mp3",
  ".aiff",
  ".aif",
  ".flac",
  ".ogg",
  ".m4a",
  ".opus",
  ".mid",
  ".midi",
]);

export function isAudioFile(filename: string): boolean {
  return AUDIO_EXTENSIONS.has(extname(filename).toLowerCase());
}

export async function readdir(dirPath: string): Promise<AudioFile[]> {
  const entries = await fsReaddir(dirPath, { withFileTypes: true });
  const results: AudioFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !isAudioFile(entry.name)) continue;

    const filePath = join(dirPath, entry.name);
    const info = await stat(filePath);

    results.push({
      path: filePath,
      name: entry.name,
      extension: extname(entry.name).toLowerCase(),
      size: info.size,
    });
  }

  return results;
}

export async function listDirs(dirPath: string): Promise<string[]> {
  const entries = await fsReaddir(dirPath, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => join(dirPath, e.name));
}

const SCAN_BATCH_SIZE = 100;

/**
 * Recursively walks dirPath (breadth-first) and calls onBatch with groups of
 * audio files. Non-blocking: each readdir awaits independently, yielding back
 * to the event loop before the next directory is processed.
 */
export async function scanFolderRecursive(
  dirPath: string,
  onBatch: (files: AudioFile[]) => void,
  signal?: AbortSignal,
): Promise<{ total: number }> {
  const queue = [dirPath];
  let batch: AudioFile[] = [];
  let total = 0;

  while (queue.length > 0) {
    if (signal?.aborted) break;

    // biome-ignore lint/style/noNonNullAssertion: queue.length > 0 guard guarantees shift() returns a value
    const current = queue.shift()!;
    let entries: Dirent[];
    try {
      entries = await fsReaddir(current, { withFileTypes: true });
    } catch {
      continue; // permission denied or other OS error — skip this dir
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        queue.push(join(current, entry.name));
        continue;
      }
      if (!entry.isFile() || !isAudioFile(entry.name)) continue;

      const filePath = join(current, entry.name);
      try {
        const info = await stat(filePath);
        batch.push({
          path: filePath,
          name: entry.name,
          extension: extname(entry.name).toLowerCase(),
          size: info.size,
        });
        total++;
      } catch {
        continue; // file disappeared between readdir and stat
      }

      if (batch.length >= SCAN_BATCH_SIZE) {
        onBatch(batch);
        batch = [];
      }
    }
  }

  if (batch.length > 0) onBatch(batch);
  return { total };
}

// Returns an unsubscribe function that stops the watcher.
export function watchDirectory(dirPath: string, onChange: () => void): () => void {
  const watcher = watch(dirPath, { persistent: false }, onChange);
  return () => watcher.close();
}
