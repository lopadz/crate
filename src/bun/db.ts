import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Tag, TagColor } from "../shared/types";

const DB_DIR = join(
  process.env.HOME ?? "/tmp",
  "Library",
  "Application Support",
  "Crate",
);
export const DB_PATH = join(DB_DIR, "db.sqlite");

const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS files (
    id               INTEGER PRIMARY KEY,
    path             TEXT NOT NULL UNIQUE,
    composite_id     TEXT NOT NULL,
    color_tag        TEXT,
    content_hash     TEXT,
    bpm              REAL,
    key              TEXT,
    lufs_integrated  REAL,
    lufs_peak        REAL,
    duration         REAL,
    format           TEXT,
    sample_rate      INTEGER,
    bit_depth        INTEGER,
    channels         INTEGER,
    last_seen_at     INTEGER,
    last_analyzed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS tags (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    color      TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS file_tags (
    file_id    INTEGER REFERENCES files(id),
    tag_id     INTEGER REFERENCES tags(id),
    created_at INTEGER,
    PRIMARY KEY (file_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS collections (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    color      TEXT,
    query_json TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS collection_files (
    collection_id INTEGER REFERENCES collections(id),
    composite_id  TEXT NOT NULL,
    added_at      INTEGER,
    PRIMARY KEY (collection_id, composite_id)
  );

  CREATE TABLE IF NOT EXISTS notes (
    composite_id TEXT PRIMARY KEY,
    content      TEXT,
    updated_at   INTEGER
  );

  CREATE TABLE IF NOT EXISTS ratings (
    composite_id TEXT PRIMARY KEY,
    value        INTEGER CHECK(value BETWEEN 1 AND 5),
    updated_at   INTEGER
  );

  CREATE TABLE IF NOT EXISTS play_history (
    composite_id TEXT    NOT NULL,
    played_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS file_operations_log (
    id             INTEGER PRIMARY KEY,
    operation      TEXT    NOT NULL,
    files_json     TEXT    NOT NULL,
    timestamp      INTEGER NOT NULL,
    rolled_back_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`;

export function initSchema(db: Database): void {
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  db.exec(CREATE_TABLES_SQL);
}

export function computeCompositeId(
  filename: string,
  duration: number,
  sampleRate: number,
): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(`${filename}:${duration}:${sampleRate}`);
  return hasher.digest("hex");
}

// Placeholder composite_id used at scan time when audio duration/sampleRate
// are not yet known. Replaced with hash(filename:duration:sampleRate) when the
// Phase 2 analysis worker processes the file.
function pathHash(path: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(path);
  return hasher.digest("hex");
}

export function createQueryHelpers(db: Database) {
  const getFileTagsStmt = db.prepare(
    `SELECT t.id, t.name, t.color, t.sort_order
     FROM tags t
     JOIN file_tags ft ON ft.tag_id = t.id
     WHERE ft.file_id = ?`,
  );

  const setColorTagStmt = db.prepare(
    `UPDATE files SET color_tag = ? WHERE id = ?`,
  );

  const setColorTagByPathStmt = db.prepare(
    `INSERT INTO files (path, composite_id, color_tag, last_seen_at)
     VALUES (?, '', ?, ?)
     ON CONFLICT(path) DO UPDATE SET color_tag = excluded.color_tag`,
  );

  const getPinnedFoldersStmt = db.prepare(
    `SELECT value FROM settings WHERE key LIKE 'pinned_folder:%'`,
  );

  const pinFolderStmt = db.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
  );

  const unpinFolderStmt = db.prepare(
    `DELETE FROM settings WHERE key = ?`,
  );

  const recordPlayStmt = db.prepare(
    `INSERT INTO play_history (composite_id, played_at) VALUES (?, ?)`,
  );

  const upsertFileStmt = db.prepare(
    `INSERT INTO files (path, composite_id, duration, format, sample_rate, key, bpm, lufs_integrated, lufs_peak, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       last_seen_at    = excluded.last_seen_at,
       composite_id    = excluded.composite_id,
       duration        = COALESCE(excluded.duration,        duration),
       format          = COALESCE(excluded.format,          format),
       sample_rate     = COALESCE(excluded.sample_rate,     sample_rate),
       key             = COALESCE(excluded.key,             key),
       bpm             = COALESCE(excluded.bpm,             bpm),
       lufs_integrated = COALESCE(excluded.lufs_integrated, lufs_integrated),
       lufs_peak       = COALESCE(excluded.lufs_peak,       lufs_peak)`,
  );

  const getFileByPathStmt = db.prepare(
    `SELECT id, composite_id, color_tag FROM files WHERE path = ?`,
  );

  const getSettingStmt = db.prepare(
    `SELECT value FROM settings WHERE key = ?`,
  );

  const setSettingStmt = db.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
  );

  // Scan-time upsert: inserts a file with a path-hash placeholder composite_id.
  // On conflict, only updates last_seen_at (and fills format if missing).
  // Does NOT overwrite a real composite_id set by the Phase 2 analysis worker.
  const upsertFileScanStmt = db.prepare(
    `INSERT INTO files (path, composite_id, format, last_seen_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       last_seen_at = excluded.last_seen_at,
       format       = COALESCE(NULLIF(format, ''), excluded.format),
       composite_id = CASE WHEN composite_id = '' THEN excluded.composite_id ELSE composite_id END`,
  );

  const upsertFilesFromScanTx = db.transaction(
    (files: Array<{ path: string; extension: string }>) => {
      const now = Date.now();
      for (const f of files) {
        // extension includes the leading dot (.wav) — strip it for the format column
        const format = f.extension.startsWith(".") ? f.extension.slice(1) : f.extension;
        upsertFileScanStmt.run(f.path, pathHash(f.path), format, now);
      }
    },
  );

  return {
    getFileTags(fileId: number): Tag[] {
      const rows = getFileTagsStmt.all(fileId) as Array<{
        id: number;
        name: string;
        color: string | null;
        sort_order: number;
      }>;
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        sortOrder: r.sort_order,
      }));
    },

    setColorTag(fileId: number, color: TagColor): void {
      setColorTagStmt.run(color, fileId);
    },

    setColorTagByPath(path: string, color: TagColor): void {
      setColorTagByPathStmt.run(path, color, Date.now());
    },

    getPinnedFolders(): string[] {
      const rows = getPinnedFoldersStmt.all() as Array<{ value: string }>;
      return rows.map((r) => r.value);
    },

    pinFolder(path: string): void {
      pinFolderStmt.run(`pinned_folder:${path}`, path);
    },

    unpinFolder(path: string): void {
      unpinFolderStmt.run(`pinned_folder:${path}`);
    },

    recordPlay(compositeId: string): void {
      recordPlayStmt.run(compositeId, Date.now());
    },

    upsertFile(params: {
      path: string;
      compositeId: string;
      duration?: number;
      format?: string;
      sampleRate?: number;
      key?: string;
      bpm?: number;
      lufsIntegrated?: number;
      lufsPeak?: number;
    }): void {
      upsertFileStmt.run(
        params.path,
        params.compositeId,
        params.duration ?? null,
        params.format ?? null,
        params.sampleRate ?? null,
        params.key ?? null,
        params.bpm ?? null,
        params.lufsIntegrated ?? null,
        params.lufsPeak ?? null,
        Date.now(),
      );
    },

    getFileByPath(
      path: string,
    ): { id: number; composite_id: string; color_tag: string | null } | null {
      return (
        (getFileByPathStmt.get(path) as {
          id: number;
          composite_id: string;
          color_tag: string | null;
        } | null) ?? null
      );
    },

    getSetting(key: string): string | null {
      const row = getSettingStmt.get(key) as { value: string } | null;
      return row?.value ?? null;
    },

    setSetting(key: string, value: string): void {
      setSettingStmt.run(key, value);
    },

    upsertFilesFromScan(files: Array<{ path: string; extension: string }>): void {
      upsertFilesFromScanTx(files);
    },
  };
}

export function openDatabase(path: string = DB_PATH): Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  initSchema(db);
  return db;
}

// App singleton — initialized once at startup
const _db = openDatabase();
export const queries = createQueryHelpers(_db);
