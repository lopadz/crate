/**
 * Non-destructive file operations for the Library Cleanup Suite.
 *
 * All operations write to `file_operations_log` via the injected `db`
 * so callers can undo and audit what changed.
 *
 * `db` is injected (not imported globally) to keep this module testable
 * with an in-memory database.
 */

import * as fs from "node:fs";
import type { QueryHelpers } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FileOpEntry = {
  originalPath: string;
  newPath: string;
};

export type OperationRecord = {
  id: number;
  operation: "rename" | "move" | "copy" | "convert" | "normalize";
  files: FileOpEntry[];
  timestamp: number;
  rolledBackAt: number | null;
};

type CopyJob = { sourcePath: string; destPath: string; overwrite?: boolean };

// ─── copyFiles ────────────────────────────────────────────────────────────────

/**
 * Non-destructively copies files to new destinations.
 * Throws if any `destPath` already exists and `overwrite` is not set.
 * Logs the operation to `file_operations_log` and returns an OperationRecord.
 */
export async function copyFiles(jobs: CopyJob[], db: QueryHelpers): Promise<OperationRecord> {
  for (const job of jobs) {
    if (!job.overwrite && fs.existsSync(job.destPath)) {
      throw new Error(`Destination already exists: ${job.destPath}`);
    }
  }

  const entries: FileOpEntry[] = [];
  for (const job of jobs) {
    await Bun.write(job.destPath, Bun.file(job.sourcePath));
    entries.push({ originalPath: job.sourcePath, newPath: job.destPath });
  }

  const timestamp = Date.now();
  const id = db.logOperation({ operation: "copy", filesJson: JSON.stringify(entries) });

  return { id, operation: "copy", files: entries, timestamp, rolledBackAt: null };
}
