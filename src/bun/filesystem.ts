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
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => join(dirPath, e.name));
}

// Returns an unsubscribe function that stops the watcher.
export function watchDirectory(
  dirPath: string,
  onChange: () => void,
): () => void {
  const watcher = watch(dirPath, { persistent: false }, onChange);
  return () => watcher.close();
}
