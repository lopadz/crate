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
      db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{
        name: string;
      }>
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
      db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{
        name: string;
      }>
    ).map((r) => r.name);
    expect(tables).toContain("files_fts");
  });

  test("files_fts_after_insert trigger populates FTS index when a file is inserted", () => {
    const db = makeDb();
    db.run(
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
    expect(computeCompositeId("kick.wav", 1.5, 44100)).toMatch(/^[0-9a-f]{64}$/);
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
    db.run(
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
    expect(() => q.setColorTagByCompositeId("nonexistent", "green")).not.toThrow();
  });
});

// ─── Color tag CRUD ───────────────────────────────────────────────────────────

describe("color tag CRUD", () => {
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    const db = makeDb();
    q = createQueryHelpers(db);
    db.run(
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
    expect(q.getPinnedFolders().filter((p) => p === "/Users/me/Samples")).toHaveLength(1);
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
    expect(q.getFileByPath("/a/kick.wav")?.composite_id).toBe("real-composite-id");
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

// ─── Rich tag system ──────────────────────────────────────────────────────────

describe("createTag", () => {
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    q = createQueryHelpers(makeDb());
  });

  test("returns a Tag with id, name, color, sortOrder", () => {
    const tag = q.createTag("kick", "#ff0000");
    expect(tag.id).toBeGreaterThan(0);
    expect(tag.name).toBe("kick");
    expect(tag.color).toBe("#ff0000");
    expect(tag.sortOrder).toBe(0);
  });

  test("accepts null color", () => {
    const tag = q.createTag("unlabeled", null);
    expect(tag.color).toBeNull();
  });

  test("each tag gets a unique id", () => {
    const t1 = q.createTag("drums", null);
    const t2 = q.createTag("synths", null);
    expect(t1.id).not.toBe(t2.id);
  });
});

describe("getAllTags", () => {
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    q = createQueryHelpers(makeDb());
  });

  test("returns empty array when no tags exist", () => {
    expect(q.getAllTags()).toEqual([]);
  });

  test("returns all created tags", () => {
    q.createTag("drums", "#f00");
    q.createTag("bass", "#00f");
    const tags = q.getAllTags();
    expect(tags).toHaveLength(2);
    expect(tags.map((t) => t.name)).toContain("drums");
    expect(tags.map((t) => t.name)).toContain("bass");
  });

  test("tags are sorted by sort_order ascending", () => {
    const db = makeDb();
    const q2 = createQueryHelpers(db);
    // Insert with explicit sort_order
    db.run(`INSERT INTO tags (name, sort_order) VALUES ('z-tag', 10)`);
    db.run(`INSERT INTO tags (name, sort_order) VALUES ('a-tag', 1)`);
    db.run(`INSERT INTO tags (name, sort_order) VALUES ('m-tag', 5)`);
    const names = q2.getAllTags().map((t) => t.name);
    expect(names).toEqual(["a-tag", "m-tag", "z-tag"]);
  });
});

describe("deleteTag", () => {
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    const db = makeDb();
    q = createQueryHelpers(db);
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/kick.wav', 'cid-1', 0)`,
    );
  });

  test("removes tag from getAllTags", () => {
    const tag = q.createTag("kick", null);
    q.deleteTag(tag.id);
    expect(q.getAllTags()).toHaveLength(0);
  });

  test("cascades: file no longer has the deleted tag", () => {
    const tag = q.createTag("kick", null);
    q.addFileTag("cid-1", tag.id);
    q.deleteTag(tag.id);
    expect(q.getFileTagsByCompositeId("cid-1")).toHaveLength(0);
  });

  test("no-ops when tag id does not exist", () => {
    expect(() => q.deleteTag(9999)).not.toThrow();
  });
});

describe("addFileTag / removeFileTag / getFileTagsByCompositeId", () => {
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    const db = makeDb();
    q = createQueryHelpers(db);
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/kick.wav', 'cid-1', 0)`,
    );
  });

  test("addFileTag → getFileTagsByCompositeId returns the tag", () => {
    const tag = q.createTag("loop", "#0f0");
    q.addFileTag("cid-1", tag.id);
    const tags = q.getFileTagsByCompositeId("cid-1");
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe("loop");
  });

  test("removeFileTag → tag no longer in list", () => {
    const tag = q.createTag("loop", null);
    q.addFileTag("cid-1", tag.id);
    q.removeFileTag("cid-1", tag.id);
    expect(q.getFileTagsByCompositeId("cid-1")).toHaveLength(0);
  });

  test("addFileTag is idempotent (no error on duplicate)", () => {
    const tag = q.createTag("loop", null);
    q.addFileTag("cid-1", tag.id);
    expect(() => q.addFileTag("cid-1", tag.id)).not.toThrow();
    expect(q.getFileTagsByCompositeId("cid-1")).toHaveLength(1);
  });

  test("multiple tags can be assigned to one file", () => {
    const t1 = q.createTag("drums", null);
    const t2 = q.createTag("bass", null);
    q.addFileTag("cid-1", t1.id);
    q.addFileTag("cid-1", t2.id);
    expect(q.getFileTagsByCompositeId("cid-1")).toHaveLength(2);
  });

  test("removeFileTag for non-existent assignment does not throw", () => {
    const tag = q.createTag("loop", null);
    expect(() => q.removeFileTag("cid-1", tag.id)).not.toThrow();
  });
});

// ─── searchFiles ──────────────────────────────────────────────────────────────

describe("searchFiles", () => {
  let db: Database;
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    db = makeDb();
    q = createQueryHelpers(db);
  });

  test("returns file whose path matches the query token", () => {
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/dark_loop_01.wav', 'cid-1', 0)`,
    );
    const results = q.searchFiles("dark");
    expect(results.some((r) => r.compositeId === "cid-1")).toBe(true);
  });

  test("returns file matching an assigned tag name", () => {
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/kick.wav', 'cid-2', 0)`,
    );
    const tag = q.createTag("groovy", null);
    q.addFileTag("cid-2", tag.id);
    const results = q.searchFiles("groovy");
    expect(results.some((r) => r.compositeId === "cid-2")).toBe(true);
  });

  test("does not return file after its tag is removed", () => {
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/snare.wav', 'cid-3', 0)`,
    );
    const tag = q.createTag("deep", null);
    q.addFileTag("cid-3", tag.id);
    q.removeFileTag("cid-3", tag.id);
    const results = q.searchFiles("deep");
    expect(results.some((r) => r.compositeId === "cid-3")).toBe(false);
  });

  test("returns empty array when no files match", () => {
    expect(q.searchFiles("zzznomatch")).toHaveLength(0);
  });

  test("result includes path and compositeId", () => {
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/hat.wav', 'cid-4', 0)`,
    );
    const results = q.searchFiles("hat");
    const match = results.find((r) => r.compositeId === "cid-4");
    expect(match).toBeDefined();
    expect(match?.path).toBe("/test/hat.wav");
  });
});

// ─── Notes ───────────────────────────────────────────────────────────────────

describe("notes", () => {
  let db: ReturnType<typeof makeDb>;
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    db = makeDb();
    q = createQueryHelpers(db);
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/loop.wav', 'note-cid-1', 0)`,
    );
  });

  test("getNote returns null when no note exists", () => {
    expect(q.getNote("note-cid-1")).toBeNull();
  });

  test("setNote persists note content", () => {
    q.setNote("note-cid-1", "This is a great kick drum");
    expect(q.getNote("note-cid-1")).toBe("This is a great kick drum");
  });

  test("setNote overwrites previous note", () => {
    q.setNote("note-cid-1", "First note");
    q.setNote("note-cid-1", "Updated note");
    expect(q.getNote("note-cid-1")).toBe("Updated note");
  });

  test("setNote syncs notes_text into files_fts", () => {
    q.setNote("note-cid-1", "dark atmospheric texture");
    const rows = db
      .query(`SELECT notes_text FROM files_fts WHERE composite_id = 'note-cid-1'`)
      .all() as Array<{ notes_text: string }>;
    expect(rows[0]?.notes_text).toBe("dark atmospheric texture");
  });

  test("searchFiles matches text added via setNote", () => {
    q.setNote("note-cid-1", "cinematic riser");
    const results = q.searchFiles("cinematic");
    expect(results.some((r) => r.compositeId === "note-cid-1")).toBe(true);
  });
});

// ─── Play History ─────────────────────────────────────────────────────────────

describe("getPlayHistory", () => {
  let db: ReturnType<typeof makeDb>;
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    db = makeDb();
    q = createQueryHelpers(db);
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/a.wav', 'ph-cid-1', 0)`,
    );
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/b.wav', 'ph-cid-2', 0)`,
    );
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/c.wav', 'ph-cid-3', 0)`,
    );
  });

  test("returns empty array when nothing has been played", () => {
    expect(q.getPlayHistory(10)).toHaveLength(0);
  });

  test("returns played files ordered by most recent first", () => {
    db.run(`INSERT INTO play_history (composite_id, played_at) VALUES ('ph-cid-1', 100)`);
    db.run(`INSERT INTO play_history (composite_id, played_at) VALUES ('ph-cid-2', 200)`);
    db.run(`INSERT INTO play_history (composite_id, played_at) VALUES ('ph-cid-3', 300)`);
    const history = q.getPlayHistory(10);
    expect(history[0].compositeId).toBe("ph-cid-3");
    expect(history[1].compositeId).toBe("ph-cid-2");
    expect(history[2].compositeId).toBe("ph-cid-1");
  });

  test("deduplicates repeated plays — only latest occurrence per file", () => {
    // Insert with explicit timestamps to avoid Date.now() collisions in fast tests
    db.run(`INSERT INTO play_history (composite_id, played_at) VALUES ('ph-cid-1', 100)`);
    db.run(`INSERT INTO play_history (composite_id, played_at) VALUES ('ph-cid-2', 200)`);
    db.run(`INSERT INTO play_history (composite_id, played_at) VALUES ('ph-cid-1', 300)`);
    const history = q.getPlayHistory(10);
    const ids = history.map((h) => h.compositeId);
    expect(ids.filter((id) => id === "ph-cid-1")).toHaveLength(1);
    expect(ids[0]).toBe("ph-cid-1"); // most recent (last_played = 300)
  });

  test("respects limit", () => {
    db.run(`INSERT INTO play_history (composite_id, played_at) VALUES ('ph-cid-1', 100)`);
    db.run(`INSERT INTO play_history (composite_id, played_at) VALUES ('ph-cid-2', 200)`);
    db.run(`INSERT INTO play_history (composite_id, played_at) VALUES ('ph-cid-3', 300)`);
    expect(q.getPlayHistory(2)).toHaveLength(2);
  });

  test("result includes path and compositeId", () => {
    q.recordPlay("ph-cid-2");
    const history = q.getPlayHistory(10);
    expect(history[0].path).toBe("/test/b.wav");
    expect(history[0].compositeId).toBe("ph-cid-2");
  });
});

// ─── Ratings ──────────────────────────────────────────────────────────────────

describe("ratings", () => {
  let db: ReturnType<typeof makeDb>;
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    db = makeDb();
    q = createQueryHelpers(db);
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/test/a.wav', 'rat-cid-1', 0)`,
    );
  });

  test("getRating returns null when no rating exists", () => {
    expect(q.getRating("rat-cid-1")).toBeNull();
  });

  test("setRating persists; getRating returns the value", () => {
    q.setRating("rat-cid-1", 5);
    expect(q.getRating("rat-cid-1")).toBe(5);
  });

  test("setRating overwrites previous rating", () => {
    q.setRating("rat-cid-1", 3);
    q.setRating("rat-cid-1", 1);
    expect(q.getRating("rat-cid-1")).toBe(1);
  });
});
