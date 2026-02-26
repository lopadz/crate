import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { findDuplicates } from "./duplicateFinder";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "crate-dup-"));
}

function writeFile(dir: string, name: string, content: string): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("findDuplicates", () => {
  let dirA: string;
  let dirB: string;

  beforeEach(() => {
    dirA = makeDir();
    dirB = makeDir();
  });

  afterEach(() => {
    fs.rmSync(dirA, { recursive: true, force: true });
    fs.rmSync(dirB, { recursive: true, force: true });
  });

  test("two files with identical content and same name → one group, reason 'exact-name'", async () => {
    writeFile(dirA, "kick.wav", "audio-data");
    writeFile(dirB, "kick.wav", "audio-data");
    const groups = await findDuplicates([dirA, dirB]);
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe("exact-name");
    expect(groups[0].files).toHaveLength(2);
  });

  test("two files with same name but different content → not grouped", async () => {
    writeFile(dirA, "kick.wav", "content-A");
    writeFile(dirB, "kick.wav", "content-B");
    const groups = await findDuplicates([dirA, dirB]);
    expect(groups).toHaveLength(0);
  });

  test("two files with different names but same SHA-256 content → grouped, reason 'content'", async () => {
    writeFile(dirA, "kick.wav", "same-bytes");
    writeFile(dirB, "snare.wav", "same-bytes");
    const groups = await findDuplicates([dirA, dirB]);
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe("content");
  });

  test("three identical files → one group with all three paths", async () => {
    const dirC = makeDir();
    writeFile(dirA, "kick.wav", "data");
    writeFile(dirB, "kick.wav", "data");
    writeFile(dirC, "kick.wav", "data");
    const groups = await findDuplicates([dirA, dirB, dirC]);
    fs.rmSync(dirC, { recursive: true, force: true });
    expect(groups).toHaveLength(1);
    expect(groups[0].files).toHaveLength(3);
  });

  test("single file with no match → not returned", async () => {
    writeFile(dirA, "kick.wav", "unique");
    const groups = await findDuplicates([dirA, dirB]);
    expect(groups).toHaveLength(0);
  });

  test("empty folder list → returns []", async () => {
    const groups = await findDuplicates([]);
    expect(groups).toHaveLength(0);
  });

  test("all unique files (no dupes) → returns []", async () => {
    writeFile(dirA, "kick.wav", "aaa");
    writeFile(dirB, "snare.wav", "bbb");
    const groups = await findDuplicates([dirA, dirB]);
    expect(groups).toHaveLength(0);
  });
});
