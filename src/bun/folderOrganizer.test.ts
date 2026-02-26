import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createQueryHelpers, initSchema } from "./db";
import type { FolderTemplate } from "./folderOrganizer";
import { executeOrganize, previewOrganize } from "./folderOrganizer";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDb() {
  const db = new Database(":memory:");
  initSchema(db);
  return createQueryHelpers(db);
}

// ── executeOrganize ───────────────────────────────────────────────────────────

describe("executeOrganize", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crate-org-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns OperationRecord with operation 'move'", async () => {
    const srcPath = path.join(tmpDir, "snare.wav");
    fs.writeFileSync(srcPath, "y");
    const destPath = path.join(tmpDir, "Drums", "snare.wav");
    const db = makeDb();
    const record = await executeOrganize([{ sourcePath: srcPath, destPath, matched: true }], db);
    expect(record.operation).toBe("move");
    expect(record.id).toBeGreaterThan(0);
  });

  test("log entry contains all moved files for undo", async () => {
    const src1 = path.join(tmpDir, "a.wav");
    const src2 = path.join(tmpDir, "b.wav");
    fs.writeFileSync(src1, "1");
    fs.writeFileSync(src2, "2");
    const dest1 = path.join(tmpDir, "out", "a.wav");
    const dest2 = path.join(tmpDir, "out", "b.wav");
    const db = makeDb();
    const record = await executeOrganize(
      [
        { sourcePath: src1, destPath: dest1, matched: true },
        { sourcePath: src2, destPath: dest2, matched: true },
      ],
      db,
    );
    expect(record.files).toHaveLength(2);
    expect(record.files[0]).toEqual({ originalPath: src1, newPath: dest1 });
    expect(record.files[1]).toEqual({ originalPath: src2, newPath: dest2 });
  });

  test("unmatched previews are skipped — file stays at original path", async () => {
    const srcPath = path.join(tmpDir, "hi-hat.wav");
    fs.writeFileSync(srcPath, "z");
    const db = makeDb();
    const record = await executeOrganize(
      [{ sourcePath: srcPath, destPath: path.join(tmpDir, "other", "hi-hat.wav"), matched: false }],
      db,
    );
    expect(fs.existsSync(srcPath)).toBe(true);
    expect(record.files).toHaveLength(0);
  });

  test("moves each matched file to its destPath", async () => {
    const srcPath = path.join(tmpDir, "kick.wav");
    fs.writeFileSync(srcPath, "x");
    const destPath = path.join(tmpDir, "Drums", "kick.wav");
    const db = makeDb();
    const preview = [{ sourcePath: srcPath, destPath, matched: true }];
    await executeOrganize(preview, db);
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.existsSync(srcPath)).toBe(false);
  });
});

// ── previewOrganize ───────────────────────────────────────────────────────────

describe("previewOrganize", () => {
  test("file with matching tags → destPath is baseDir/targetPath/filename", () => {
    const template: FolderTemplate = {
      name: "Drums",
      rules: [{ tags: ["kick"], targetPath: "Drums/Kicks" }],
    };
    const previews = previewOrganize(
      [{ path: "/library/kick_001.wav", tags: ["kick"] }],
      template,
      "/library",
    );
    expect(previews).toHaveLength(1);
    expect(previews[0].destPath).toBe("/library/Drums/Kicks/kick_001.wav");
    expect(previews[0].matched).toBe(true);
  });

  test("first matching rule wins when multiple rules could match", () => {
    const template: FolderTemplate = {
      name: "Multi",
      rules: [
        { tags: ["kick"], targetPath: "Drums/Kicks" },
        { tags: ["kick"], targetPath: "Drums/Other" },
      ],
    };
    const previews = previewOrganize([{ path: "/lib/kick.wav", tags: ["kick"] }], template, "/lib");
    expect(previews[0].destPath).toBe("/lib/Drums/Kicks/kick.wav");
  });

  test("no matching rule and no fallbackPath → destPath unchanged, matched false", () => {
    const template: FolderTemplate = { name: "T", rules: [{ tags: ["snare"], targetPath: "S" }] };
    const previews = previewOrganize([{ path: "/lib/kick.wav", tags: ["kick"] }], template, "/lib");
    expect(previews[0].destPath).toBe("/lib/kick.wav");
    expect(previews[0].matched).toBe(false);
  });

  test("no matching rule with fallbackPath → destPath uses fallbackPath, matched false", () => {
    const template: FolderTemplate = {
      name: "T",
      rules: [{ tags: ["snare"], targetPath: "S" }],
      fallbackPath: "Unsorted",
    };
    const previews = previewOrganize([{ path: "/lib/kick.wav", tags: ["kick"] }], template, "/lib");
    expect(previews[0].destPath).toBe("/lib/Unsorted/kick.wav");
    expect(previews[0].matched).toBe(false);
  });

  test("previewOrganize is pure — no filesystem changes occur", () => {
    const template: FolderTemplate = {
      name: "T",
      rules: [{ tags: ["kick"], targetPath: "Drums" }],
    };
    const srcPath = path.join(os.tmpdir(), "pure-test-kick.wav");
    fs.writeFileSync(srcPath, "x");
    previewOrganize([{ path: srcPath, tags: ["kick"] }], template, os.tmpdir());
    // File should still be at its original location
    expect(fs.existsSync(srcPath)).toBe(true);
    fs.rmSync(srcPath, { force: true });
  });
});
