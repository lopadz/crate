import * as fs from "node:fs";
import * as path from "node:path";
import type { createQueryHelpers } from "./db";
import type { OperationRecord } from "./fileOps";

export type FolderRule = {
  tags: string[];
  targetPath: string;
};

export type FolderTemplate = {
  name: string;
  rules: FolderRule[];
  fallbackPath?: string;
};

export type MovePreview = {
  sourcePath: string;
  destPath: string;
  matched: boolean;
};

type FileWithTags = { path: string; tags: string[] };

export function previewOrganize(
  files: FileWithTags[],
  template: FolderTemplate,
  baseDir: string,
): MovePreview[] {
  return files.map((file) => {
    const matchedRule = template.rules.find((rule) =>
      rule.tags.every((t) => file.tags.includes(t)),
    );

    if (matchedRule) {
      return {
        sourcePath: file.path,
        destPath: path.join(baseDir, matchedRule.targetPath, path.basename(file.path)),
        matched: true,
      };
    }

    if (template.fallbackPath != null) {
      return {
        sourcePath: file.path,
        destPath: path.join(baseDir, template.fallbackPath, path.basename(file.path)),
        matched: false,
      };
    }

    return { sourcePath: file.path, destPath: file.path, matched: false };
  });
}

export async function executeOrganize(
  previews: MovePreview[],
  db: ReturnType<typeof createQueryHelpers>,
): Promise<OperationRecord> {
  const matched = previews.filter((p) => p.matched);
  for (const p of matched) {
    fs.mkdirSync(path.dirname(p.destPath), { recursive: true });
    fs.renameSync(p.sourcePath, p.destPath);
  }
  const entries = matched.map((p) => ({ originalPath: p.sourcePath, newPath: p.destPath }));
  const timestamp = Date.now();
  const id = db.logOperation({ operation: "move", filesJson: JSON.stringify(entries) });
  return { id, operation: "move", files: entries, timestamp, rolledBackAt: null };
}
