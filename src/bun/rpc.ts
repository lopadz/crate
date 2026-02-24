import { BrowserView, Utils } from "electrobun/bun";
import type { CrateRPC } from "../shared/types";
import type { AnalysisError, AnalysisResult } from "./analysisQueue";
import { AnalysisQueue } from "./analysisQueue";
import { queries } from "./db";
import { createDragCopy } from "./dragDrop";
import {
  listDirs,
  readdir,
  scanFolderRecursive,
  watchDirectory,
} from "./filesystem";

// Active directory watchers — keyed by path
const watchers = new Map<string, () => void>();

// Active scan controllers — keyed by folder path.
// Allows aborting an in-progress scan if the folder is unpinned.
const scanControllers = new Map<string, AbortController>();

// Singleton analysis queue — shared for the app lifetime
const analysisQueue = new AnalysisQueue({ maxConcurrent: 2 });

async function runScan(
  path: string,
  signal: AbortSignal,
  onDone: (path: string) => void,
): Promise<void> {
  await scanFolderRecursive(
    path,
    (files) => queries.upsertFilesFromScan(files),
    signal,
  );
  if (!signal.aborted) onDone(path);
}

export type AnalysisResultCallback = (result: AnalysisResult) => void;

// createRpc accepts callbacks so index.ts can forward notifications to the
// renderer without a circular dependency.
export function createRpc(
  onDirectoryChanged: (path: string) => void,
  onAnalysisResult: AnalysisResultCallback = () => {},
) {
  analysisQueue.on("result", (result: AnalysisResult) => {
    queries.setAnalysisResult(result.compositeId, result);
    onAnalysisResult(result);
  });
  // Swallow worker errors — individual file failures should not crash the app
  analysisQueue.on("error", (_err: AnalysisError) => {});

  return BrowserView.defineRPC<CrateRPC>({
    maxRequestTime: Infinity,
    handlers: {
      requests: {
        fsReaddir: async ({ path }) => {
          const files = await readdir(path);
          const dbData = queries.getFilesDataBatch(files.map((f) => f.path));
          return files.map((f) => {
            const data = dbData.get(f.path);
            return data
              ? {
                  ...f,
                  compositeId: data.compositeId,
                  colorTag: data.colorTag,
                  bpm: data.bpm ?? undefined,
                  key: data.key ?? undefined,
                  keyCamelot: data.keyCamelot ?? undefined,
                  lufsIntegrated: data.lufsIntegrated ?? undefined,
                  lufsPeak: data.lufsPeak ?? undefined,
                  dynamicRange: data.dynamicRange ?? undefined,
                }
              : f;
          });
        },

        fsListDirs: ({ path }) => listDirs(path),

        fsOpenFolderDialog: async ({ directoryPath }) => {
          const startingFolder = directoryPath ?? process.env.HOME ?? "/";
          const paths = await Utils.openFileDialog({
            canChooseDirectory: true,
            canChooseFiles: false,
            allowsMultipleSelection: true,
            startingFolder,
          });
          return (paths ?? []).filter((p) => p.length > 0);
        },

        fsReadAudio: async ({ path }) => {
          const buf = await Bun.file(path).arrayBuffer();
          return Buffer.from(buf).toString("base64");
        },

        fsGetMetadata: ({ path }) => {
          const file = queries.getFileByPath(path);
          if (!file) return null;
          // Return only what the DB has cached from a previous analysis run.
          // The renderer (Mediabunny) fills in the rest for new/unanalyzed files.
          const row = file as unknown as Record<string, unknown>;
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

        dbGetFileTags: ({ compositeId }) =>
          queries.getFileTagsByCompositeId(compositeId),

        dbGetAllTags: () => queries.getAllTags(),

        dbGetPinnedFolders: () => queries.getPinnedFolders(),

        dbCreateTag: ({ name, color }) => queries.createTag(name, color),

        dawCreateDragCopy: ({ path, pattern, bpm, key, keyCamelot }) =>
          createDragCopy({ filePath: path, pattern, bpm, key, keyCamelot }),

        dbSearchFiles: ({ query }) => {
          const results = queries.searchFiles(query);
          return results.map((r) => ({
            path: r.path,
            name: r.path.split("/").pop() ?? r.path,
            extension: r.path.includes(".")
              ? `.${r.path.split(".").pop()}`
              : "",
            size: 0,
            compositeId: r.compositeId,
          }));
        },

        dbGetNote: ({ compositeId }) => queries.getNote(compositeId),

        dbGetRating: ({ compositeId }) => queries.getRating(compositeId),

        dbGetPlayHistory: ({ limit }) => {
          const results = queries.getPlayHistory(limit);
          return results.map((r) => ({
            path: r.path,
            name: r.path.split("/").pop() ?? r.path,
            extension: r.path.includes(".")
              ? `.${r.path.split(".").pop()}`
              : "",
            size: 0,
            compositeId: r.compositeId,
          }));
        },

        analysisGetStatus: () => analysisQueue.getStatus(),

        collectionGetAll: () => queries.getCollections(),

        collectionCreate: ({ name, color, queryJson }) =>
          queries.createCollection(name, color, queryJson),

        collectionGetFiles: ({ collectionId }) => {
          const files = queries.getCollectionFiles(collectionId);
          return files.map((f) => ({
            path: f.path,
            name: f.path.split("/").pop() ?? f.path,
            extension: f.path.includes(".")
              ? `.${f.path.split(".").pop()}`
              : "",
            size: 0,
            compositeId: f.compositeId,
          }));
        },
      },

      messages: {
        settingsSet: ({ key, value }) => queries.setSetting(key, value),

        dbSetColorTag: ({ compositeId, color }) =>
          queries.setColorTagByCompositeId(compositeId, color),

        dbPinFolder: ({ path }) => {
          queries.pinFolder(path);
          const controller = new AbortController();
          scanControllers.set(path, controller);
          void runScan(path, controller.signal, onDirectoryChanged).finally(
            () => {
              scanControllers.delete(path);
            },
          );
        },

        dbUnpinFolder: ({ path }) => {
          scanControllers.get(path)?.abort();
          scanControllers.delete(path);
          queries.unpinFolder(path);
        },

        dbRecordPlay: ({ compositeId }) => queries.recordPlay(compositeId),

        dbDeleteTag: ({ tagId }) => queries.deleteTag(tagId),

        dbAddFileTag: ({ compositeId, tagId }) =>
          queries.addFileTag(compositeId, tagId),

        dbRemoveFileTag: ({ compositeId, tagId }) =>
          queries.removeFileTag(compositeId, tagId),

        dbSetNote: ({ compositeId, content }) =>
          queries.setNote(compositeId, content),

        dbSetRating: ({ compositeId, value }) =>
          queries.setRating(compositeId, value),

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

        analysisQueueFile: ({ compositeId, path }) => {
          analysisQueue.enqueue(compositeId, path);
        },

        collectionDelete: ({ collectionId }) =>
          queries.deleteCollection(collectionId),

        collectionAddFile: ({ collectionId, compositeId }) =>
          queries.addToCollection(collectionId, compositeId),

        collectionRemoveFile: ({ collectionId, compositeId }) =>
          queries.removeFromCollection(collectionId, compositeId),
      },
    },
  });
}
