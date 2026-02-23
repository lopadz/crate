import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { computeCompositeId, createQueryHelpers, initSchema } from "./db";

function makeDb() {
  const db = new Database(":memory:");
  initSchema(db);
  return db;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

describe("initSchema", () => {
  test("creates all required tables", () => {
    const db = makeDb();
    const tables = (
      db
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        )
        .all() as Array<{ name: string }>
    ).map((r) => r.name);

    for (const t of [
      "files",
      "tags",
      "file_tags",
      "collections",
      "collection_files",
      "notes",
      "ratings",
      "play_history",
      "file_operations_log",
      "settings",
    ]) {
      expect(tables).toContain(t);
    }
  });

  test("is idempotent (safe to call twice)", () => {
    const db = makeDb();
    expect(() => initSchema(db)).not.toThrow();
  });

  test("creates files_fts virtual table for full-text search", () => {
    const db = makeDb();
    const tables = (
      db
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        )
        .all() as Array<{ name: string }>
    ).map((r) => r.name);
    expect(tables).toContain("files_fts");
  });

  test("files_fts_after_insert trigger populates FTS index when a file is inserted", () => {
    const db = makeDb();
    db.exec(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/dark_loop.wav', 'cid-123', 0)`,
    );
    const rows = db
      .query(`SELECT composite_id FROM files_fts WHERE files_fts MATCH 'dark'`)
      .all() as Array<{ composite_id: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].composite_id).toBe("cid-123");
  });
});

// ─── computeCompositeId ───────────────────────────────────────────────────────

describe("computeCompositeId", () => {
  test("returns a 64-char hex string", () => {
    expect(computeCompositeId("kick.wav", 1.5, 44100)).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  test("same inputs → same id", () => {
    expect(computeCompositeId("kick.wav", 1.5, 44100)).toBe(
      computeCompositeId("kick.wav", 1.5, 44100),
    );
  });

  test("different filename → different id", () => {
    expect(computeCompositeId("kick.wav", 1.5, 44100)).not.toBe(
      computeCompositeId("snare.wav", 1.5, 44100),
    );
  });

  test("different duration → different id", () => {
    expect(computeCompositeId("kick.wav", 1.5, 44100)).not.toBe(
      computeCompositeId("kick.wav", 2.0, 44100),
    );
  });

  test("different sampleRate → different id", () => {
    expect(computeCompositeId("kick.wav", 1.5, 44100)).not.toBe(
      computeCompositeId("kick.wav", 1.5, 48000),
    );
  });
});

// ─── setColorTagByCompositeId ─────────────────────────────────────────────────

describe("setColorTagByCompositeId", () => {
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    const db = makeDb();
    q = createQueryHelpers(db);
    db.exec(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/kick.wav', 'cid-abc123', 0)`,
    );
  });

  test("sets color tag by composite_id", () => {
    q.setColorTagByCompositeId("cid-abc123", "green");
    expect(q.getFileByPath("/test/kick.wav")?.color_tag).toBe("green");
  });

  test("overwrites previous tag", () => {
    q.setColorTagByCompositeId("cid-abc123", "green");
    q.setColorTagByCompositeId("cid-abc123", "red");
    expect(q.getFileByPath("/test/kick.wav")?.color_tag).toBe("red");
  });

  test("accepts null to clear", () => {
    q.setColorTagByCompositeId("cid-abc123", "yellow");
    q.setColorTagByCompositeId("cid-abc123", null);
    expect(q.getFileByPath("/test/kick.wav")?.color_tag).toBeNull();
  });

  test("no-ops when composite_id does not exist", () => {
    expect(() =>
      q.setColorTagByCompositeId("nonexistent", "green"),
    ).not.toThrow();
  });
});

// ─── Color tag CRUD ───────────────────────────────────────────────────────────

describe("color tag CRUD", () => {
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    const db = makeDb();
    q = createQueryHelpers(db);
    db.exec(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/kick.wav', 'abc123', 0)`,
    );
  });

  test("setColorTag persists green", () => {
    q.setColorTag(1, "green");
    expect(q.getFileByPath("/test/kick.wav")?.color_tag).toBe("green");
  });

  test("setColorTag overwrites previous tag", () => {
    q.setColorTag(1, "green");
    q.setColorTag(1, "red");
    expect(q.getFileByPath("/test/kick.wav")?.color_tag).toBe("red");
  });

  test("setColorTag accepts null to clear", () => {
    q.setColorTag(1, "yellow");
    q.setColorTag(1, null);
    expect(q.getFileByPath("/test/kick.wav")?.color_tag).toBeNull();
  });
});

// ─── Pinned folders ───────────────────────────────────────────────────────────

describe("pinned folders", () => {
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    q = createQueryHelpers(makeDb());
  });

  test("pinFolder persists and getPinnedFolders returns it", () => {
    q.pinFolder("/Users/me/Samples");
    expect(q.getPinnedFolders()).toContain("/Users/me/Samples");
  });

  test("unpinFolder removes it", () => {
    q.pinFolder("/Users/me/Samples");
    q.unpinFolder("/Users/me/Samples");
    expect(q.getPinnedFolders()).not.toContain("/Users/me/Samples");
  });

  test("pinFolder is idempotent", () => {
    q.pinFolder("/Users/me/Samples");
    q.pinFolder("/Users/me/Samples");
    expect(
      q.getPinnedFolders().filter((p) => p === "/Users/me/Samples"),
    ).toHaveLength(1);
  });

  test("multiple pinned folders all returned", () => {
    q.pinFolder("/Users/me/Drums");
    q.pinFolder("/Users/me/Synths");
    const pinned = q.getPinnedFolders();
    expect(pinned).toContain("/Users/me/Drums");
    expect(pinned).toContain("/Users/me/Synths");
  });
});

// ─── upsertFile ───────────────────────────────────────────────────────────────

describe("upsertFile", () => {
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    q = createQueryHelpers(makeDb());
  });

  test("inserts a new file", () => {
    q.upsertFile({ path: "/a/kick.wav", compositeId: "abc", duration: 1.5 });
    expect(q.getFileByPath("/a/kick.wav")).not.toBeNull();
  });

  test("updates existing file on conflict without clearing composite_id", () => {
    q.upsertFile({ path: "/a/kick.wav", compositeId: "abc", duration: 1.5 });
    q.upsertFile({ path: "/a/kick.wav", compositeId: "abc", duration: 2.0 });
    expect(q.getFileByPath("/a/kick.wav")?.composite_id).toBe("abc");
  });
});

// ─── upsertFilesFromScan ──────────────────────────────────────────────────────

describe("upsertFilesFromScan", () => {
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    q = createQueryHelpers(makeDb());
  });

  test("inserts files with a non-empty placeholder composite_id", () => {
    q.upsertFilesFromScan([{ path: "/a/kick.wav", extension: ".wav" }]);
    const f = q.getFileByPath("/a/kick.wav");
    expect(f).not.toBeNull();
    expect(f?.composite_id).toBeTruthy();
    expect(f?.composite_id).not.toBe("");
  });

  test("each file gets a unique placeholder composite_id", () => {
    q.upsertFilesFromScan([
      { path: "/a/kick.wav", extension: ".wav" },
      { path: "/a/snare.wav", extension: ".wav" },
    ]);
    const id1 = q.getFileByPath("/a/kick.wav")?.composite_id;
    const id2 = q.getFileByPath("/a/snare.wav")?.composite_id;
    expect(id1).not.toBe(id2);
  });

  test("placeholder composite_id is stable across re-scans", () => {
    q.upsertFilesFromScan([{ path: "/a/kick.wav", extension: ".wav" }]);
    const id1 = q.getFileByPath("/a/kick.wav")?.composite_id;
    q.upsertFilesFromScan([{ path: "/a/kick.wav", extension: ".wav" }]);
    const id2 = q.getFileByPath("/a/kick.wav")?.composite_id;
    expect(id1).toBe(id2);
  });

  test("preserves a real composite_id set by analysis — does not overwrite", () => {
    q.upsertFile({
      path: "/a/kick.wav",
      compositeId: "real-composite-id",
      duration: 1.5,
    });
    q.upsertFilesFromScan([{ path: "/a/kick.wav", extension: ".wav" }]);
    expect(q.getFileByPath("/a/kick.wav")?.composite_id).toBe(
      "real-composite-id",
    );
  });

  test("handles a batch of multiple files in one transaction", () => {
    const files = [
      { path: "/a/kick.wav", extension: ".wav" },
      { path: "/a/snare.wav", extension: ".wav" },
      { path: "/a/hat.mp3", extension: ".mp3" },
    ];
    q.upsertFilesFromScan(files);
    for (const f of files) {
      expect(q.getFileByPath(f.path)).not.toBeNull();
    }
  });

  test("handles an empty array without error", () => {
    expect(() => q.upsertFilesFromScan([])).not.toThrow();
  });
});
