import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

export interface ResolveOptions {
  original: string; // basename WITHOUT extension
  bpm?: number | null;
  key?: string | null;
  keyCamelot?: string | null;
}

/**
 * Resolves token placeholders in a drag-rename pattern.
 * `original` should be the file's base name WITHOUT its extension —
 * the caller appends the extension when building the final filename.
 *
 * Known tokens: {original}, {bpm}, {key}, {key_camelot}
 * Unknown tokens are left as literal text (e.g. `{notes}` stays `{notes}`).
 */
export function resolvePattern(pattern: string, opts: ResolveOptions): string {
  const { original, bpm, key, keyCamelot } = opts;
  return pattern
    .replace(/\{original\}/g, original)
    .replace(/\{bpm\}/g, bpm != null ? String(Math.round(bpm)) : "{bpm}")
    .replace(/\{key\}/g, key ?? "{key}")
    .replace(/\{key_camelot\}/g, keyCamelot ?? "{key_camelot}");
}

export interface DragCopyOptions {
  pattern: string;
  filePath: string;
  bpm?: number | null;
  key?: string | null;
  keyCamelot?: string | null;
}

/**
 * Creates a renamed copy of the audio file in a unique temp directory.
 * Returns the path to the copy — ready to be set as drag data.
 */
export async function createDragCopy(opts: DragCopyOptions): Promise<string> {
  const { pattern, filePath, bpm, key, keyCamelot } = opts;
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  const resolvedBase = resolvePattern(pattern, {
    original: base,
    bpm,
    key,
    keyCamelot,
  });
  const resolvedName = resolvedBase + ext;

  const tmpDir = `/tmp/crate-drag/${randomUUID()}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  const destPath = path.join(tmpDir, resolvedName);
  await Bun.write(destPath, Bun.file(filePath));

  return destPath;
}
