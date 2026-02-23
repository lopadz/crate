import { BrowserView } from "electrobun/bun";
import type { CrateRPC } from "../shared/types";
import { queries } from "./db";
import { readdir, listDirs, watchDirectory } from "./filesystem";

// Active directory watchers — keyed by path
const watchers = new Map<string, () => void>();

// createRpc accepts a callback so index.ts can forward directory-change
// notifications to the renderer without a circular dependency.
export function createRpc(onDirectoryChanged: (path: string) => void) {
  return BrowserView.defineRPC<CrateRPC>({
    maxRequestTime: 5000,
    handlers: {
      requests: {
        fsReaddir: ({ path }) => readdir(path),

        fsListDirs: ({ path }) => listDirs(path),

        fsGetMetadata: ({ path }) => {
          const file = queries.getFileByPath(path);
          if (!file) return null;
          // Return only what the DB has cached from a previous analysis run.
          // The renderer (Mediabunny) fills in the rest for new/unanalyzed files.
          const row = (file as unknown as Record<string, unknown>);
          const duration = row["duration"] as number | null;
          if (!duration) return null;
          return {
            duration,
            format: (row["format"] as string | null) ?? "unknown",
            sampleRate: (row["sample_rate"] as number | null) ?? 44100,
            bitDepth: (row["bit_depth"] as number | null) ?? 16,
            channels: (row["channels"] as number | null) ?? 2,
          };
        },

        settingsGet: ({ key }) => queries.getSetting(key),

        dbGetFileTags: ({ fileId }) => queries.getFileTags(fileId),

        dbGetPinnedFolders: () => queries.getPinnedFolders(),
      },

      messages: {
        settingsSet: ({ key, value }) => queries.setSetting(key, value),

        dbSetColorTag: ({ path, color }) => queries.setColorTagByPath(path, color),

        dbPinFolder: ({ path }) => queries.pinFolder(path),

        dbUnpinFolder: ({ path }) => queries.unpinFolder(path),

        dbRecordPlay: ({ compositeId }) => queries.recordPlay(compositeId),

        fsStartWatch: ({ path }) => {
          if (watchers.has(path)) return;
          const unsubscribe = watchDirectory(path, () =>
            onDirectoryChanged(path),
          );
          watchers.set(path, unsubscribe);
        },

        fsStopWatch: ({ path }) => {
          watchers.get(path)?.();
          watchers.delete(path);
        },
      },
    },
  });
}
