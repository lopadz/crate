import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export type DuplicateGroup = {
  fingerprint: string;
  files: string[];
  reason: "exact-name" | "content";
};

function sha256(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function collectFiles(folderPaths: string[]): string[] {
  const files: string[] = [];
  for (const dir of folderPaths) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile()) files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function groupByNameHash(files: string[], hashes: Map<string, string>): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const f of files) {
    const key = `${path.basename(f)}::${hashes.get(f) ?? ""}`;
    const group = result.get(key) ?? [];
    group.push(f);
    result.set(key, group);
  }
  return result;
}

function groupByContentHash(files: string[], hashes: Map<string, string>): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const f of files) {
    const hash = hashes.get(f) ?? "";
    const group = result.get(hash) ?? [];
    group.push(f);
    result.set(hash, group);
  }
  return result;
}

export async function findDuplicates(folderPaths: string[]): Promise<DuplicateGroup[]> {
  const files = collectFiles(folderPaths);
  if (files.length < 2) return [];

  const hashes = new Map<string, string>(); // path → sha256
  for (const f of files) hashes.set(f, sha256(f));

  const byNameHash = groupByNameHash(files, hashes);
  const byContentHash = groupByContentHash(files, hashes);

  const groups: DuplicateGroup[] = [];
  const covered = new Set<string>(); // paths already in an exact-name group

  for (const [key, filePaths] of byNameHash) {
    if (filePaths.length < 2) continue;
    for (const p of filePaths) covered.add(p);
    groups.push({ fingerprint: key, files: filePaths, reason: "exact-name" });
  }

  for (const [hash, filePaths] of byContentHash) {
    if (filePaths.length < 2) continue;
    const uncovered = filePaths.filter((p) => !covered.has(p));
    if (uncovered.length < 2) continue;
    groups.push({ fingerprint: hash, files: filePaths, reason: "content" });
  }

  return groups;
}
