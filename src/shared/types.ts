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
      fsReadAudio: { params: { path: string }; response: string }; // base64-encoded bytes
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
      // Analysis
      analysisGetStatus: {
        params: Record<string, never>;
        response: { pending: number; running: number; total: number };
      };
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
    };
  }>;
};
