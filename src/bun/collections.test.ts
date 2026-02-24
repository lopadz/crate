import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { buildCollectionQuery } from "./collections";
import { createQueryHelpers, initSchema } from "./db";

function makeDb() {
  const db = new Database(":memory:");
  initSchema(db);
  return db;
}

// ─── buildCollectionQuery — SQL shape ─────────────────────────────────────────

describe("buildCollectionQuery — BPM filter", () => {
  test("generates BETWEEN clause for bpm range", () => {
    const { sql, params } = buildCollectionQuery(
      JSON.stringify({ bpm: { min: 120, max: 130 } }),
    );
    expect(sql).toContain("WHERE");
    expect(sql).toMatch(/bpm BETWEEN \? AND \?/);
    expect(params).toContain(120);
    expect(params).toContain(130);
  });
});

describe("buildCollectionQuery — key filter", () => {
  test("generates IN clause for key array", () => {
    const { sql, params } = buildCollectionQuery(
      JSON.stringify({ key: ["Am", "Cm"] }),
    );
    expect(sql).toContain("WHERE");
    expect(sql).toMatch(/key IN \(\?,\s*\?\)/);
    expect(params).toContain("Am");
    expect(params).toContain("Cm");
  });

  test("single key generates IN clause with one placeholder", () => {
    const { sql, params } = buildCollectionQuery(
      JSON.stringify({ key: ["Am"] }),
    );
    expect(sql).toMatch(/key IN \(\?\)/);
    expect(params).toContain("Am");
  });
});

describe("buildCollectionQuery — tag filter", () => {
  test("generates EXISTS subquery for tags array", () => {
    const { sql, params } = buildCollectionQuery(
      JSON.stringify({ tags: ["loop"] }),
    );
    expect(sql).toContain("WHERE");
    expect(sql).toContain("EXISTS");
    expect(params).toContain("loop");
  });

  test("multiple tags generate correct number of placeholders", () => {
    const { sql, params } = buildCollectionQuery(
      JSON.stringify({ tags: ["loop", "kick"] }),
    );
    expect(params).toContain("loop");
    expect(params).toContain("kick");
  });
});

describe("buildCollectionQuery — combined filters", () => {
  test("multiple filters are joined with AND", () => {
    const { sql, params } = buildCollectionQuery(
      JSON.stringify({ bpm: { min: 120, max: 130 }, key: ["Am"] }),
    );
    expect(sql).toMatch(/bpm BETWEEN/);
    expect(sql).toMatch(/key IN/);
    expect(sql).toContain("AND");
    expect(params).toContain(120);
    expect(params).toContain("Am");
  });

  test("three filters all present in SQL", () => {
    const { sql } = buildCollectionQuery(
      JSON.stringify({
        bpm: { min: 100, max: 140 },
        key: ["G"],
        tags: ["loop"],
      }),
    );
    expect(sql).toMatch(/bpm BETWEEN/);
    expect(sql).toMatch(/key IN/);
    expect(sql).toContain("EXISTS");
  });
});

describe("buildCollectionQuery — empty / manual collection", () => {
  test("empty object produces no WHERE clause", () => {
    const { sql, params } = buildCollectionQuery("{}");
    expect(sql).not.toContain("WHERE");
    expect(params).toHaveLength(0);
  });

  test("empty string produces no WHERE clause", () => {
    const { sql } = buildCollectionQuery("");
    expect(sql).not.toContain("WHERE");
  });
});

describe("buildCollectionQuery — parameterized (no interpolation)", () => {
  test("key values are in params, not in SQL string", () => {
    const { sql, params } = buildCollectionQuery(
      JSON.stringify({ key: ["Am"] }),
    );
    expect(sql).not.toContain("Am");
    expect(params).toContain("Am");
  });

  test("BPM values are in params, not in SQL string", () => {
    const { sql, params } = buildCollectionQuery(
      JSON.stringify({ bpm: { min: 128, max: 128 } }),
    );
    expect(sql).not.toContain("128");
    expect(params).toContain(128);
  });
});

// ─── Collection CRUD ──────────────────────────────────────────────────────────

describe("collections CRUD", () => {
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    q = createQueryHelpers(makeDb());
  });

  test("createCollection returns a Collection with id", () => {
    const c = q.createCollection("My Kicks", null, null);
    expect(c.id).toBeGreaterThan(0);
    expect(c.name).toBe("My Kicks");
    expect(c.color).toBeNull();
    expect(c.queryJson).toBeNull();
  });

  test("getCollections returns all collections", () => {
    q.createCollection("A", null, null);
    q.createCollection("B", "#f00", "{}");
    const cols = q.getCollections();
    expect(cols).toHaveLength(2);
    expect(cols.map((c) => c.name)).toContain("A");
    expect(cols.map((c) => c.name)).toContain("B");
  });

  test("deleteCollection removes it", () => {
    const c = q.createCollection("Temp", null, null);
    q.deleteCollection(c.id);
    expect(q.getCollections()).toHaveLength(0);
  });

  test("deleteCollection no-ops on unknown id", () => {
    expect(() => q.deleteCollection(9999)).not.toThrow();
  });
});

// ─── Manual collection files ──────────────────────────────────────────────────

describe("manual collection files", () => {
  let db: Database;
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    db = makeDb();
    q = createQueryHelpers(db);
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/a/kick.wav', 'cid-1', 0)`,
    );
    db.run(
      `INSERT INTO files (path, composite_id, last_seen_at) VALUES ('/a/snare.wav', 'cid-2', 0)`,
    );
  });

  test("addToCollection → getCollectionFiles returns that file", () => {
    const c = q.createCollection("Manual", null, null);
    q.addToCollection(c.id, "cid-1");
    const files = q.getCollectionFiles(c.id);
    expect(files.some((f) => f.compositeId === "cid-1")).toBe(true);
  });

  test("removeFromCollection removes the file", () => {
    const c = q.createCollection("Manual", null, null);
    q.addToCollection(c.id, "cid-1");
    q.removeFromCollection(c.id, "cid-1");
    expect(q.getCollectionFiles(c.id)).toHaveLength(0);
  });

  test("addToCollection is idempotent", () => {
    const c = q.createCollection("Manual", null, null);
    q.addToCollection(c.id, "cid-1");
    expect(() => q.addToCollection(c.id, "cid-1")).not.toThrow();
    expect(q.getCollectionFiles(c.id)).toHaveLength(1);
  });
});

// ─── Smart collection query execution ─────────────────────────────────────────

describe("getCollectionFiles — smart collection", () => {
  let db: Database;
  let q: ReturnType<typeof createQueryHelpers>;

  beforeEach(() => {
    db = makeDb();
    q = createQueryHelpers(db);
    db.run(
      `INSERT INTO files (path, composite_id, bpm, key, last_seen_at) VALUES ('/a/kick.wav', 'cid-1', 128, 'Am', 0)`,
    );
    db.run(
      `INSERT INTO files (path, composite_id, bpm, key, last_seen_at) VALUES ('/a/snare.wav', 'cid-2', 90, 'C', 0)`,
    );
    db.run(
      `INSERT INTO files (path, composite_id, bpm, key, last_seen_at) VALUES ('/a/hat.wav', 'cid-3', 140, 'Am', 0)`,
    );
  });

  test("BPM range filter returns matching files", () => {
    const c = q.createCollection(
      "Fast",
      null,
      JSON.stringify({ bpm: { min: 120, max: 135 } }),
    );
    const files = q.getCollectionFiles(c.id);
    expect(files).toHaveLength(1);
    expect(files[0].compositeId).toBe("cid-1");
  });

  test("key filter returns matching files", () => {
    const c = q.createCollection(
      "Am songs",
      null,
      JSON.stringify({ key: ["Am"] }),
    );
    const files = q.getCollectionFiles(c.id);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.compositeId)).toContain("cid-1");
    expect(files.map((f) => f.compositeId)).toContain("cid-3");
  });

  test("combined BPM + key filter returns intersection", () => {
    const c = q.createCollection(
      "Am 120-135",
      null,
      JSON.stringify({ bpm: { min: 120, max: 135 }, key: ["Am"] }),
    );
    const files = q.getCollectionFiles(c.id);
    expect(files).toHaveLength(1);
    expect(files[0].compositeId).toBe("cid-1");
  });

  test("empty query_json returns all files", () => {
    const c = q.createCollection("All", null, "{}");
    const files = q.getCollectionFiles(c.id);
    expect(files).toHaveLength(3);
  });
});
