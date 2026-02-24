import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Collection, Tag, TagColor } from "../shared/types";
import { buildCollectionQuery } from "./collections";

const DB_DIR = join(
  process.env.HOME ?? "/tmp",
  "Library",
  "Application Support",
  "Crate",
);
export const DB_PATH = join(DB_DIR, "db.sqlite");

// Individual DDL statements — each run with db.run() to avoid the deprecated
// db.exec(sql, ...bindings) overload. db.run() is the non-deprecated single-statement API.
const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS files (
    id               INTEGER PRIMARY KEY,
    path             TEXT NOT NULL UNIQUE,
    composite_id     TEXT NOT NULL,
    color_tag        TEXT,
    content_hash     TEXT,
    bpm              REAL,
    key              TEXT,
    key_camelot      TEXT,
    lufs_integrated  REAL,
    lufs_peak        REAL,
    dynamic_range    REAL,
    duration         REAL,
    format           TEXT,
    sample_rate      INTEGER,
    bit_depth        INTEGER,
    channels         INTEGER,
    last_seen_at     INTEGER,
    last_analyzed_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS tags (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    color      TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS file_tags (
    file_id    INTEGER REFERENCES files(id),
    tag_id     INTEGER REFERENCES tags(id),
    created_at INTEGER,
    PRIMARY KEY (file_id, tag_id)
  )`,
  `CREATE TABLE IF NOT EXISTS collections (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    color      TEXT,
    query_json TEXT,
    created_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS collection_files (
    collection_id INTEGER REFERENCES collections(id),
    composite_id  TEXT NOT NULL,
    added_at      INTEGER,
    PRIMARY KEY (collection_id, composite_id)
  )`,
  `CREATE TABLE IF NOT EXISTS notes (
    composite_id TEXT PRIMARY KEY,
    content      TEXT,
    updated_at   INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS ratings (
    composite_id TEXT PRIMARY KEY,
    value        INTEGER CHECK(value BETWEEN 1 AND 5),
    updated_at   INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS play_history (
    composite_id TEXT    NOT NULL,
    played_at    INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS file_operations_log (
    id             INTEGER PRIMARY KEY,
    operation      TEXT    NOT NULL,
    files_json     TEXT    NOT NULL,
    timestamp      INTEGER NOT NULL,
    rolled_back_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  )`,
  // FTS5 virtual table for full-text search across filenames, tags, and notes
  `CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
    composite_id UNINDEXED,
    filename,
    tags_text,
    notes_text
  )`,
  // Trigger to keep files_fts in sync when a file is inserted
  `CREATE TRIGGER IF NOT EXISTS files_fts_after_insert AFTER INSERT ON files BEGIN
    INSERT INTO files_fts(composite_id, filename) VALUES (new.composite_id, new.path);
  END`,
] as const;

// Columns added in Phase 2 that may be absent in DBs created before that migration.
const PHASE2_MIGRATIONS = [
  `ALTER TABLE files ADD COLUMN key_camelot TEXT`,
  `ALTER TABLE files ADD COLUMN dynamic_range REAL`,
  `ALTER TABLE files ADD COLUMN last_analyzed_at INTEGER`,
];

export function initSchema(db: Database): void {
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  for (const sql of DDL_STATEMENTS) {
    db.run(sql);
  }
  // Idempotent column additions — SQLite ignores "duplicate column" errors
  for (const sql of PHASE2_MIGRATIONS) {
    try {
      db.run(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }
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

  const getFileTagsByCompositeIdStmt = db.prepare(
    `SELECT t.id, t.name, t.color, t.sort_order
     FROM tags t
     JOIN file_tags ft ON ft.tag_id = t.id
     WHERE ft.file_id = (SELECT id FROM files WHERE composite_id = ?)`,
  );

  const getAllTagsStmt = db.prepare(
    `SELECT id, name, color, sort_order FROM tags ORDER BY sort_order ASC`,
  );

  const createTagStmt = db.prepare(
    `INSERT INTO tags (name, color, sort_order, created_at) VALUES (?, ?, 0, ?)
     RETURNING id, name, color, sort_order`,
  );

  const deleteTagStmt = db.prepare(`DELETE FROM tags WHERE id = ?`);

  const addFileTagStmt = db.prepare(
    `INSERT OR IGNORE INTO file_tags (file_id, tag_id, created_at)
     VALUES ((SELECT id FROM files WHERE composite_id = ?), ?, ?)`,
  );

  const removeFileTagStmt = db.prepare(
    `DELETE FROM file_tags
     WHERE file_id = (SELECT id FROM files WHERE composite_id = ?)
       AND tag_id = ?`,
  );

  const deleteFileTagsByTagIdStmt = db.prepare(
    `DELETE FROM file_tags WHERE tag_id = ?`,
  );

  // Syncs the tags_text column in files_fts after addFileTag / removeFileTag
  const updateFtsTagsStmt = db.prepare(
    `UPDATE files_fts
     SET tags_text = (
       SELECT COALESCE(GROUP_CONCAT(t.name, ' '), '')
       FROM tags t
       JOIN file_tags ft ON ft.tag_id = t.id
       JOIN files f ON f.id = ft.file_id
       WHERE f.composite_id = ?
     )
     WHERE composite_id = ?`,
  );

  const searchFilesStmt = db.prepare(
    `SELECT f.path, f.composite_id
     FROM files_fts
     JOIN files f ON f.composite_id = files_fts.composite_id
     WHERE files_fts MATCH ?
     ORDER BY rank`,
  );

  const createCollectionStmt = db.prepare(
    `INSERT INTO collections (name, color, query_json, created_at) VALUES (?, ?, ?, ?)
     RETURNING id, name, color, query_json`,
  );

  const getCollectionsStmt = db.prepare(
    `SELECT id, name, color, query_json FROM collections ORDER BY id ASC`,
  );

  const getCollectionByIdStmt = db.prepare(
    `SELECT id, name, color, query_json FROM collections WHERE id = ?`,
  );

  const deleteCollectionStmt = db.prepare(
    `DELETE FROM collections WHERE id = ?`,
  );

  const addToCollectionStmt = db.prepare(
    `INSERT OR IGNORE INTO collection_files (collection_id, composite_id, added_at) VALUES (?, ?, ?)`,
  );

  const removeFromCollectionStmt = db.prepare(
    `DELETE FROM collection_files WHERE collection_id = ? AND composite_id = ?`,
  );

  const getManualCollectionFilesStmt = db.prepare(
    `SELECT f.path, f.composite_id FROM files f
     JOIN collection_files cf ON cf.composite_id = f.composite_id
     WHERE cf.collection_id = ?`,
  );

  const setColorTagStmt = db.prepare(
    `UPDATE files SET color_tag = ? WHERE id = ?`,
  );

  const setColorTagByCompositeIdStmt = db.prepare(
    `UPDATE files SET color_tag = ? WHERE composite_id = ?`,
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

  const unpinFolderStmt = db.prepare(`DELETE FROM settings WHERE key = ?`);

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
    `SELECT id, composite_id, color_tag, bpm, key, key_camelot, lufs_integrated, lufs_peak, dynamic_range FROM files WHERE path = ?`,
  );

  const setAnalysisResultStmt = db.prepare(
    `UPDATE files SET
       bpm              = ?,
       key              = ?,
       key_camelot      = ?,
       lufs_integrated  = ?,
       lufs_peak        = ?,
       dynamic_range    = ?,
       last_analyzed_at = ?
     WHERE composite_id = ?`,
  );

  const getSettingStmt = db.prepare(`SELECT value FROM settings WHERE key = ?`);

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
        const format = f.extension.startsWith(".")
          ? f.extension.slice(1)
          : f.extension;
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

    getFileTagsByCompositeId(compositeId: string): Tag[] {
      const rows = getFileTagsByCompositeIdStmt.all(compositeId) as Array<{
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

    getAllTags(): Tag[] {
      const rows = getAllTagsStmt.all() as Array<{
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

    createTag(name: string, color: string | null): Tag {
      const row = createTagStmt.get(name, color, Date.now()) as {
        id: number;
        name: string;
        color: string | null;
        sort_order: number;
      };
      return {
        id: row.id,
        name: row.name,
        color: row.color,
        sortOrder: row.sort_order,
      };
    },

    deleteTag(tagId: number): void {
      deleteFileTagsByTagIdStmt.run(tagId);
      deleteTagStmt.run(tagId);
    },

    addFileTag(compositeId: string, tagId: number): void {
      addFileTagStmt.run(compositeId, tagId, Date.now());
      updateFtsTagsStmt.run(compositeId, compositeId);
    },

    removeFileTag(compositeId: string, tagId: number): void {
      removeFileTagStmt.run(compositeId, tagId);
      updateFtsTagsStmt.run(compositeId, compositeId);
    },

    searchFiles(query: string): Array<{ path: string; compositeId: string }> {
      // Append * to each term for prefix matching (e.g. "dar" matches "dark")
      const ftsQuery = query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => `${t}*`)
        .join(" ");
      if (!ftsQuery) return [];
      const rows = searchFilesStmt.all(ftsQuery) as Array<{
        path: string;
        composite_id: string;
      }>;
      return rows.map((r) => ({ path: r.path, compositeId: r.composite_id }));
    },

    setColorTag(fileId: number, color: TagColor): void {
      setColorTagStmt.run(color, fileId);
    },

    setColorTagByCompositeId(compositeId: string, color: TagColor): void {
      setColorTagByCompositeIdStmt.run(color, compositeId);
    },

    setColorTagByPath(path: string, color: TagColor): void {
      setColorTagByPathStmt.run(path, color, Date.now());
    },

    getFilesDataBatch(paths: string[]): Map<
      string,
      {
        compositeId: string;
        colorTag: TagColor;
        bpm: number | null;
        key: string | null;
        keyCamelot: string | null;
        lufsIntegrated: number | null;
        lufsPeak: number | null;
        dynamicRange: number | null;
      }
    > {
      const result = new Map<
        string,
        {
          compositeId: string;
          colorTag: TagColor;
          bpm: number | null;
          key: string | null;
          keyCamelot: string | null;
          lufsIntegrated: number | null;
          lufsPeak: number | null;
          dynamicRange: number | null;
        }
      >();
      if (paths.length === 0) return result;
      db.transaction(() => {
        for (const path of paths) {
          const row = getFileByPathStmt.get(path) as {
            id: number;
            composite_id: string;
            color_tag: string | null;
            bpm: number | null;
            key: string | null;
            key_camelot: string | null;
            lufs_integrated: number | null;
            lufs_peak: number | null;
            dynamic_range: number | null;
          } | null;
          if (row) {
            result.set(path, {
              compositeId: row.composite_id,
              colorTag: (row.color_tag as TagColor) ?? null,
              bpm: row.bpm,
              key: row.key,
              keyCamelot: row.key_camelot,
              lufsIntegrated: row.lufs_integrated,
              lufsPeak: row.lufs_peak,
              dynamicRange: row.dynamic_range,
            });
          }
        }
      })();
      return result;
    },

    setAnalysisResult(
      compositeId: string,
      data: {
        bpm: number | null;
        key: string | null;
        keyCamelot: string | null;
        lufsIntegrated: number;
        lufsPeak: number;
        dynamicRange: number;
      },
    ): void {
      setAnalysisResultStmt.run(
        data.bpm,
        data.key,
        data.keyCamelot,
        data.lufsIntegrated,
        data.lufsPeak,
        data.dynamicRange,
        Date.now(),
        compositeId,
      );
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

    upsertFilesFromScan(
      files: Array<{ path: string; extension: string }>,
    ): void {
      upsertFilesFromScanTx(files);
    },

    createCollection(
      name: string,
      color: string | null,
      queryJson: string | null,
    ): Collection {
      const row = createCollectionStmt.get(
        name,
        color,
        queryJson,
        Date.now(),
      ) as {
        id: number;
        name: string;
        color: string | null;
        query_json: string | null;
      };
      return {
        id: row.id,
        name: row.name,
        color: row.color,
        queryJson: row.query_json,
      };
    },

    getCollections(): Collection[] {
      const rows = getCollectionsStmt.all() as Array<{
        id: number;
        name: string;
        color: string | null;
        query_json: string | null;
      }>;
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        queryJson: r.query_json,
      }));
    },

    deleteCollection(id: number): void {
      deleteCollectionStmt.run(id);
    },

    addToCollection(collectionId: number, compositeId: string): void {
      addToCollectionStmt.run(collectionId, compositeId, Date.now());
    },

    removeFromCollection(collectionId: number, compositeId: string): void {
      removeFromCollectionStmt.run(collectionId, compositeId);
    },

    getCollectionFiles(
      collectionId: number,
    ): Array<{ path: string; compositeId: string }> {
      const collection = getCollectionByIdStmt.get(collectionId) as {
        id: number;
        query_json: string | null;
      } | null;
      if (!collection) return [];

      if (collection.query_json !== null) {
        // Smart collection — run the dynamic query
        const { sql, params } = buildCollectionQuery(collection.query_json);
        const rows = db
          .prepare(sql)
          // biome-ignore lint/suspicious/noExplicitAny: dynamic params from buildCollectionQuery
          .all(...(params as any[])) as Array<{
          path: string;
          composite_id: string;
        }>;
        return rows.map((r) => ({ path: r.path, compositeId: r.composite_id }));
      }

      // Manual collection — use the junction table
      const rows = getManualCollectionFilesStmt.all(collectionId) as Array<{
        path: string;
        composite_id: string;
      }>;
      return rows.map((r) => ({ path: r.path, compositeId: r.composite_id }));
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
