import type { RPCSchema } from "electrobun/bun";

export type TagColor = "green" | "yellow" | "red" | null;

export interface AudioFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  // Populated after analysis:
  duration?: number;
  format?: string;
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
  bpm?: number;
  key?: string;
  keyCamelot?: string;
  lufsIntegrated?: number;
  lufsPeak?: number;
  dynamicRange?: number;
  colorTag?: TagColor;
  compositeId?: string;
  rating?: number;
}

export interface AudioMetadata {
  duration: number;
  format: string;
  sampleRate: number;
  bitDepth: number;
  channels: number;
}

export interface Tag {
  id: number;
  name: string;
  color: string | null;
  sortOrder: number;
}

export interface Collection {
  id: number;
  name: string;
  color: string | null;
  queryJson: string | null;
}

// ─── Phase 3 RPC shared shapes ───────────────────────────────────────────────
// Defined here so CrateRPC can reference them without importing from bun/

type FileOpEntry = { originalPath: string; newPath: string };
type OpsRecord = {
  id: number;
  operation: string;
  files: FileOpEntry[];
  timestamp: number;
  rolledBackAt: number | null;
};
type MetadataWriteJobRpc = {
  path: string;
  bpm?: number | null;
  key?: string | null;
  lufs?: number | null;
};
type DuplicateGroupRpc = { fingerprint: string; files: string[]; reason: "exact-name" | "content" };
type FolderRuleRpc = { tags: string[]; targetPath: string };
type FolderTemplateRpc = { name: string; rules: FolderRuleRpc[]; fallbackPath?: string };
type MovePreviewRpc = { sourcePath: string; destPath: string; matched: boolean };
type FileWithTagsRpc = { path: string; tags: string[] };

// ─── Electrobun typed RPC schema ─────────────────────────────────────────────
//
// Bun side  → handles requests/messages FROM the renderer
// Webview side → handles messages FROM the main process (e.g. directory change)

export type CrateRPC = {
  bun: RPCSchema<{
    requests: {
      // Filesystem
      fsReaddir: { params: { path: string }; response: AudioFile[] };
      fsListDirs: { params: { path: string }; response: string[] };
      fsOpenFolderDialog: {
        params: { directoryPath?: string };
        response: string[];
      };
      fsGetMetadata: {
        params: { path: string };
        response: AudioMetadata | null;
      };
      fsReadAudio: { params: { path: string }; response: string }; // base64-encoded bytes (legacy fallback)
      fsGetAudioConfig: {
        params: Record<string, never>;
        response: { baseUrl: string; token: string };
      };
      // Settings
      settingsGet: { params: { key: string }; response: string | null };
      // Database — reads
      dbGetFileTags: { params: { compositeId: string }; response: Tag[] };
      dbGetAllTags: { params: Record<string, never>; response: Tag[] };
      dbGetPinnedFolders: { params: Record<string, never>; response: string[] };
      dbCreateTag: {
        params: { name: string; color: string | null };
        response: Tag;
      };
      // DAW integration
      dawCreateDragCopy: {
        params: {
          path: string;
          pattern: string;
          bpm?: number | null;
          key?: string | null;
          keyCamelot?: string | null;
        };
        response: string; // absolute path to the temp copy
      };
      // Full-text search
      dbSearchFiles: {
        params: { query: string };
        response: AudioFile[];
      };
      // Analysis
      analysisGetStatus: {
        params: Record<string, never>;
        response: { pending: number; running: number; total: number };
      };
      // Notes
      dbGetNote: { params: { compositeId: string }; response: string | null };
      // Ratings
      dbGetRating: { params: { compositeId: string }; response: number | null };
      // Play history
      dbGetPlayHistory: { params: { limit: number }; response: AudioFile[] };
      // Collections
      collectionGetAll: {
        params: Record<string, never>;
        response: Collection[];
      };
      collectionCreate: {
        params: {
          name: string;
          color: string | null;
          queryJson: string | null;
        };
        response: Collection;
      };
      collectionGetFiles: {
        params: { collectionId: number };
        response: AudioFile[];
      };
      // Phase 3 — file operations
      opsRenameFiles: { params: { jobs: FileOpEntry[] }; response: OpsRecord };
      opsGetLog: { params: Record<string, never>; response: OpsRecord[] };
      opsUndo: { params: { recordId: number }; response: undefined };
      // Phase 3 — conversion
      convertBatch: { params: { paths: string[]; presetId: string }; response: undefined };
      convertCancel: { params: Record<string, never>; response: undefined };
      // Phase 3 — metadata
      metadataBatchWrite: { params: { jobs: MetadataWriteJobRpc[] }; response: OpsRecord };
      // Phase 3 — duplicates
      dupesScan: { params: { folderPaths: string[] }; response: DuplicateGroupRpc[] };
      dupesResolve: { params: { keep: string; toDelete: string[] }; response: undefined };
      // Phase 3 — folder organize
      organizePreview: {
        params: { template: FolderTemplateRpc; files: FileWithTagsRpc[] };
        response: MovePreviewRpc[];
      };
      organizeExecute: { params: { previews: MovePreviewRpc[] }; response: OpsRecord };
    };
    messages: {
      // Settings
      settingsSet: { key: string; value: string };
      // Database — writes
      dbSetColorTag: { compositeId: string; color: TagColor };
      dbPinFolder: { path: string };
      dbUnpinFolder: { path: string };
      dbRecordPlay: { compositeId: string };
      dbDeleteTag: { tagId: number };
      dbAddFileTag: { compositeId: string; tagId: number };
      dbRemoveFileTag: { compositeId: string; tagId: number };
      // Filesystem watch
      fsStartWatch: { path: string };
      fsStopWatch: { path: string };
      // Analysis
      analysisQueueFile: { compositeId: string; path: string };
      // Notes
      dbSetNote: { compositeId: string; content: string };
      // Ratings
      dbSetRating: { compositeId: string; value: number };
      // Collections
      collectionDelete: { collectionId: number };
      collectionAddFile: { collectionId: number; compositeId: string };
      collectionRemoveFile: { collectionId: number; compositeId: string };
    };
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      // Main notifies renderer when a watched directory changes
      fsDirectoryChanged: { path: string };
      // Main pushes analysis result when a worker finishes
      analysisResult: {
        compositeId: string;
        bpm: number | null;
        key: string | null;
        keyCamelot: string | null;
        lufsIntegrated: number;
        lufsPeak: number;
        dynamicRange: number;
      };
      // Phase 3 — conversion progress
      convertProgress: { fileId: string; percent: number };
      convertComplete: { fileId: string; outputPath: string };
      // Phase 3 — undo availability
      opsUndoAvailable: { recordId: number; operation: string };
    };
  }>;
};
