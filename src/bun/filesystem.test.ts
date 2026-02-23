import { describe, test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isAudioFile, readdir, listDirs, watchDirectory, AUDIO_EXTENSIONS } from "./filesystem";

function makeTempDir(files: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "crate-test-"));
  for (const f of files) writeFileSync(join(dir, f), "test");
  return { dir, cleanup: () => rmSync(dir, { recursive: true }) };
}

// ─── AUDIO_EXTENSIONS ────────────────────────────────────────────────────────

describe("AUDIO_EXTENSIONS", () => {
  test("includes all required extensions", () => {
    for (const ext of [
      ".wav", ".mp3", ".aiff", ".aif", ".flac",
      ".ogg", ".m4a", ".opus", ".mid", ".midi",
    ]) {
      expect(AUDIO_EXTENSIONS.has(ext)).toBe(true);
    }
  });
});

// ─── isAudioFile ──────────────────────────────────────────────────────────────

describe("isAudioFile", () => {
  test("returns true for all supported audio extensions", () => {
    for (const name of [
      "kick.wav", "loop.mp3", "pad.aiff", "bass.aif", "beat.flac",
      "atmo.ogg", "seq.m4a", "lead.opus", "piano.mid", "drums.midi",
    ]) {
      expect(isAudioFile(name)).toBe(true);
    }
  });

  test("returns false for non-audio files", () => {
    for (const name of ["readme.txt", "photo.jpg", "data.json", "script.js", "doc.pdf"]) {
      expect(isAudioFile(name)).toBe(false);
    }
  });

  test("is case-insensitive", () => {
    expect(isAudioFile("KICK.WAV")).toBe(true);
    expect(isAudioFile("loop.MP3")).toBe(true);
    expect(isAudioFile("PAD.AIFF")).toBe(true);
  });

  test("returns false for files with no extension", () => {
    expect(isAudioFile("noextension")).toBe(false);
  });
});

// ─── readdir ─────────────────────────────────────────────────────────────────

describe("readdir", () => {
  test("returns only audio files, filters out non-audio", async () => {
    const { dir, cleanup } = makeTempDir(["kick.wav", "snare.mp3", "photo.jpg", "readme.txt"]);
    try {
      const files = await readdir(dir);
      const names = files.map((f) => f.name);
      expect(names).toContain("kick.wav");
      expect(names).toContain("snare.mp3");
      expect(names).not.toContain("photo.jpg");
      expect(names).not.toContain("readme.txt");
    } finally {
      cleanup();
    }
  });

  test("returns empty array when no audio files present", async () => {
    const { dir, cleanup } = makeTempDir(["readme.txt", "photo.jpg"]);
    try {
      expect(await readdir(dir)).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  test("returns empty array for empty directory", async () => {
    const { dir, cleanup } = makeTempDir([]);
    try {
      expect(await readdir(dir)).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  test("accepts all supported extensions", async () => {
    const audioFiles = [
      "a.wav", "b.mp3", "c.aiff", "d.aif", "e.flac",
      "f.ogg", "g.m4a", "h.opus", "i.mid", "j.midi",
    ];
    const { dir, cleanup } = makeTempDir([...audioFiles, "z.txt"]);
    try {
      expect(await readdir(dir)).toHaveLength(audioFiles.length);
    } finally {
      cleanup();
    }
  });

  test("returns AudioFile objects with correct shape", async () => {
    const { dir, cleanup } = makeTempDir(["kick.wav"]);
    try {
      const [file] = await readdir(dir);
      expect(file.name).toBe("kick.wav");
      expect(file.extension).toBe(".wav");
      expect(typeof file.path).toBe("string");
      expect(typeof file.size).toBe("number");
      expect(file.size).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });
});

// ─── watchDirectory ───────────────────────────────────────────────────────────

// ─── listDirs ────────────────────────────────────────────────────────────────

describe("listDirs", () => {
  test("returns only subdirectory paths", async () => {
    const { dir, cleanup } = makeTempDir(["audio.wav", "note.txt"]);
    try {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(join(dir, "SubA"));
      mkdirSync(join(dir, "SubB"));
      const dirs = await listDirs(dir);
      expect(dirs).toHaveLength(2);
      expect(dirs.some((p: string) => p.endsWith("SubA"))).toBe(true);
      expect(dirs.some((p: string) => p.endsWith("SubB"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("returns empty array when no subdirectories", async () => {
    const { dir, cleanup } = makeTempDir(["audio.wav"]);
    try {
      expect(await listDirs(dir)).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  test("returns full absolute paths", async () => {
    const { dir, cleanup } = makeTempDir([]);
    try {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(join(dir, "MySamples"));
      const [p] = await listDirs(dir);
      expect(p.startsWith("/")).toBe(true);
      expect(p.endsWith("MySamples")).toBe(true);
    } finally {
      cleanup();
    }
  });
});

describe("watchDirectory", () => {
  test("returns an unsubscribe function", () => {
    const { dir, cleanup } = makeTempDir([]);
    try {
      const unsubscribe = watchDirectory(dir, () => {});
      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    } finally {
      cleanup();
    }
  });
});
