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
import type { OperationLogRow, QueryHelpers } from "./db";

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

type RenameJob = { originalPath: string; newPath: string };

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

// ─── renameFiles ──────────────────────────────────────────────────────────────

/**
 * Renames (moves) files to new paths on disk.
 * Logs the operation so it can be undone via `undoOperation`.
 */
export async function renameFiles(jobs: RenameJob[], db: QueryHelpers): Promise<OperationRecord> {
  const entries: FileOpEntry[] = [];
  for (const job of jobs) {
    fs.renameSync(job.originalPath, job.newPath);
    entries.push({ originalPath: job.originalPath, newPath: job.newPath });
  }

  const timestamp = Date.now();
  const id = db.logOperation({ operation: "rename", filesJson: JSON.stringify(entries) });

  return { id, operation: "rename", files: entries, timestamp, rolledBackAt: null };
}

// ─── undoOperation ────────────────────────────────────────────────────────────

/**
 * Reverses a logged operation:
 * - rename/move → moves newPath back to originalPath
 * - copy → deletes newPath (originalPath is untouched)
 * Marks the log entry as rolled back.
 */
export async function undoOperation(record: OperationRecord, db: QueryHelpers): Promise<void> {
  for (const entry of record.files) {
    if (record.operation === "rename" || record.operation === "move") {
      fs.renameSync(entry.newPath, entry.originalPath);
    } else if (record.operation === "copy") {
      fs.rmSync(entry.newPath, { force: true });
    }
  }
  db.markRolledBack(record.id);
}

// ─── getOperationsLog ─────────────────────────────────────────────────────────

/**
 * Returns the active (not rolled-back) operations log, newest first.
 * Parses `files_json` from each DB row into typed `FileOpEntry[]`.
 */
export function getOperationsLog(db: QueryHelpers): OperationRecord[] {
  return db
    .getOperationsLog()
    .filter((row: OperationLogRow) => row.rolled_back_at === null)
    .map((row: OperationLogRow) => ({
      id: row.id,
      operation: row.operation as OperationRecord["operation"],
      files: JSON.parse(row.files_json) as FileOpEntry[],
      timestamp: row.timestamp,
      rolledBackAt: row.rolled_back_at,
    }));
}
