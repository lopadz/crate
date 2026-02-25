import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createQueryHelpers, initSchema } from "./db";
import { copyFiles } from "./fileOps";

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
