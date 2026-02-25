import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createQueryHelpers, initSchema } from "./db";
import { copyFiles, getOperationsLog, renameFiles, undoOperation } from "./fileOps";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDb() {
  const db = new Database(":memory:");
  initSchema(db);
  return createQueryHelpers(db);
}

function tmpFile(name: string, content = "audio-content"): string {
  const p = path.join(os.tmpdir(), `crate-test-${Date.now()}-${name}`);
  fs.writeFileSync(p, content);
  return p;
}

// ── copyFiles ─────────────────────────────────────────────────────────────────

describe("copyFiles", () => {
  let db: ReturnType<typeof makeDb>;
  const created: string[] = [];

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    for (const p of created) {
      try {
        fs.rmSync(p, { force: true });
      } catch {
        // ignore
      }
    }
    created.length = 0;
  });

  test("creates a new file at destPath with the same content", async () => {
    const src = tmpFile("src.wav");
    const dest = path.join(os.tmpdir(), `crate-test-dest-${Date.now()}.wav`);
    created.push(src, dest);

    await copyFiles([{ sourcePath: src, destPath: dest }], db);

    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.readFileSync(dest, "utf8")).toBe("audio-content");
  });

  test("original file at sourcePath is untouched after copy", async () => {
    const src = tmpFile("src2.wav", "original-data");
    const dest = path.join(os.tmpdir(), `crate-test-dest2-${Date.now()}.wav`);
    created.push(src, dest);

    await copyFiles([{ sourcePath: src, destPath: dest }], db);

    expect(fs.existsSync(src)).toBe(true);
    expect(fs.readFileSync(src, "utf8")).toBe("original-data");
  });

  test("returns an OperationRecord with operation 'copy'", async () => {
    const src = tmpFile("src3.wav");
    const dest = path.join(os.tmpdir(), `crate-test-dest3-${Date.now()}.wav`);
    created.push(src, dest);

    const record = await copyFiles([{ sourcePath: src, destPath: dest }], db);

    expect(record.operation).toBe("copy");
    expect(typeof record.id).toBe("number");
    expect(record.rolledBackAt).toBeNull();
  });

  test("OperationRecord.files[].originalPath points to a file that still exists", async () => {
    const src = tmpFile("src4.wav");
    const dest = path.join(os.tmpdir(), `crate-test-dest4-${Date.now()}.wav`);
    created.push(src, dest);

    const record = await copyFiles([{ sourcePath: src, destPath: dest }], db);

    expect(record.files[0].originalPath).toBe(src);
    expect(fs.existsSync(record.files[0].originalPath)).toBe(true);
  });

  test("log entry is written to file_operations_log", async () => {
    const src = tmpFile("src5.wav");
    const dest = path.join(os.tmpdir(), `crate-test-dest5-${Date.now()}.wav`);
    created.push(src, dest);

    await copyFiles([{ sourcePath: src, destPath: dest }], db);

    const log = db.getOperationsLog();
    expect(log.length).toBe(1);
    expect(log[0].operation).toBe("copy");
  });

  test("copying to an existing path without overwrite:true throws", async () => {
    const src = tmpFile("src6.wav");
    const dest = tmpFile("dest6.wav", "existing");
    created.push(src, dest);

    await expect(copyFiles([{ sourcePath: src, destPath: dest }], db)).rejects.toThrow(
      /already exists/,
    );
  });

  test("copying to an existing path with overwrite:true succeeds", async () => {
    const src = tmpFile("src7.wav", "new-content");
    const dest = tmpFile("dest7.wav", "old-content");
    created.push(src, dest);

    await copyFiles([{ sourcePath: src, destPath: dest, overwrite: true }], db);

    expect(fs.readFileSync(dest, "utf8")).toBe("new-content");
  });
});

// ── renameFiles ───────────────────────────────────────────────────────────────

describe("renameFiles", () => {
  let db: ReturnType<typeof makeDb>;
  const created: string[] = [];

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    for (const p of created) {
      try {
        fs.rmSync(p, { force: true });
      } catch {
        // ignore
      }
    }
    created.length = 0;
  });

  test("moves the file to the new path", async () => {
    const src = tmpFile("ren1.wav", "data");
    const dest = path.join(os.tmpdir(), `crate-test-ren1-new-${Date.now()}.wav`);
    created.push(src, dest);

    await renameFiles([{ originalPath: src, newPath: dest }], db);

    expect(fs.existsSync(dest)).toBe(true);
  });

  test("original path no longer exists after rename", async () => {
    const src = tmpFile("ren2.wav", "data");
    const dest = path.join(os.tmpdir(), `crate-test-ren2-new-${Date.now()}.wav`);
    created.push(src, dest);

    await renameFiles([{ originalPath: src, newPath: dest }], db);

    expect(fs.existsSync(src)).toBe(false);
  });

  test("new path has the same content as the original", async () => {
    const src = tmpFile("ren3.wav", "my-audio");
    const dest = path.join(os.tmpdir(), `crate-test-ren3-new-${Date.now()}.wav`);
    created.push(src, dest);

    await renameFiles([{ originalPath: src, newPath: dest }], db);

    expect(fs.readFileSync(dest, "utf8")).toBe("my-audio");
  });

  test("returns OperationRecord with operation 'rename', originalPath, newPath", async () => {
    const src = tmpFile("ren4.wav");
    const dest = path.join(os.tmpdir(), `crate-test-ren4-new-${Date.now()}.wav`);
    created.push(src, dest);

    const record = await renameFiles([{ originalPath: src, newPath: dest }], db);

    expect(record.operation).toBe("rename");
    expect(record.files[0].originalPath).toBe(src);
    expect(record.files[0].newPath).toBe(dest);
  });

  test("log entry is persisted with rolledBackAt null", async () => {
    const src = tmpFile("ren5.wav");
    const dest = path.join(os.tmpdir(), `crate-test-ren5-new-${Date.now()}.wav`);
    created.push(src, dest);

    await renameFiles([{ originalPath: src, newPath: dest }], db);

    const log = db.getOperationsLog();
    expect(log[0].operation).toBe("rename");
    expect(log[0].rolled_back_at).toBeNull();
  });
});

// ── undoOperation ─────────────────────────────────────────────────────────────

describe("undoOperation", () => {
  let db: ReturnType<typeof makeDb>;
  const created: string[] = [];

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    for (const p of created) {
      try {
        fs.rmSync(p, { force: true });
      } catch {
        // ignore
      }
    }
    created.length = 0;
  });

  test("undo rename restores the original filename", async () => {
    const src = tmpFile("undo1.wav", "content");
    const dest = path.join(os.tmpdir(), `crate-test-undo1-new-${Date.now()}.wav`);
    created.push(src, dest);

    const record = await renameFiles([{ originalPath: src, newPath: dest }], db);
    await undoOperation(record, db);

    expect(fs.existsSync(src)).toBe(true);
  });

  test("after undo rename, newPath no longer exists", async () => {
    const src = tmpFile("undo2.wav");
    const dest = path.join(os.tmpdir(), `crate-test-undo2-new-${Date.now()}.wav`);
    created.push(src, dest);

    const record = await renameFiles([{ originalPath: src, newPath: dest }], db);
    await undoOperation(record, db);

    expect(fs.existsSync(dest)).toBe(false);
  });

  test("undoOperation sets rolled_back_at in the DB", async () => {
    const src = tmpFile("undo3.wav");
    const dest = path.join(os.tmpdir(), `crate-test-undo3-new-${Date.now()}.wav`);
    created.push(src, dest);

    const record = await renameFiles([{ originalPath: src, newPath: dest }], db);
    await undoOperation(record, db);

    const log = db.getOperationsLog();
    expect(log[0].rolled_back_at).not.toBeNull();
  });

  test("undo copy deletes newPath; originalPath is untouched", async () => {
    const src = tmpFile("undo4.wav", "original");
    const dest = path.join(os.tmpdir(), `crate-test-undo4-copy-${Date.now()}.wav`);
    created.push(src, dest);

    const record = await copyFiles([{ sourcePath: src, destPath: dest }], db);
    await undoOperation(record, db);

    expect(fs.existsSync(dest)).toBe(false);
    expect(fs.existsSync(src)).toBe(true);
    expect(fs.readFileSync(src, "utf8")).toBe("original");
  });
});

// ── getOperationsLog ──────────────────────────────────────────────────────────

describe("getOperationsLog (fileOps)", () => {
  let db: ReturnType<typeof makeDb>;
  const created: string[] = [];

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    for (const p of created) {
      try {
        fs.rmSync(p, { force: true });
      } catch {
        // ignore
      }
    }
    created.length = 0;
  });

  test("returns records in reverse-chronological order (newest first)", async () => {
    const src1 = tmpFile("log1.wav");
    const dest1 = path.join(os.tmpdir(), `crate-test-log1-new-${Date.now()}.wav`);
    const src2 = tmpFile("log2.wav");
    const dest2 = path.join(os.tmpdir(), `crate-test-log2-copy-${Date.now()}.wav`);
    created.push(src1, dest1, src2, dest2);

    await renameFiles([{ originalPath: src1, newPath: dest1 }], db);
    await copyFiles([{ sourcePath: dest1, destPath: dest2 }], db);

    const log = getOperationsLog(db);
    expect(log[0].operation).toBe("copy");
    expect(log[1].operation).toBe("rename");
  });

  test("excludes entries where rolled_back_at is set", async () => {
    const src = tmpFile("log3.wav");
    const dest = path.join(os.tmpdir(), `crate-test-log3-new-${Date.now()}.wav`);
    created.push(src, dest);

    const record = await renameFiles([{ originalPath: src, newPath: dest }], db);
    await undoOperation(record, db);

    const log = getOperationsLog(db);
    expect(log.length).toBe(0);
  });
});
