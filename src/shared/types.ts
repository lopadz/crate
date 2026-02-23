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
  lufsIntegrated?: number;
  lufsPeak?: number;
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
      fsGetMetadata: {
        params: { path: string };
        response: AudioMetadata | null;
      };
      // Settings
      settingsGet: { params: { key: string }; response: string | null };
      // Database — reads
      dbGetFileTags: { params: { fileId: number }; response: Tag[] };
      dbGetPinnedFolders: { params: Record<string, never>; response: string[] };
    };
    messages: {
      // Settings
      settingsSet: { key: string; value: string };
      // Database — writes
      dbSetColorTag: { path: string; color: TagColor };
      dbPinFolder: { path: string };
      dbUnpinFolder: { path: string };
      dbRecordPlay: { compositeId: string };
      // Filesystem watch
      fsStartWatch: { path: string };
      fsStopWatch: { path: string };
    };
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      // Main notifies renderer when a watched directory changes
      fsDirectoryChanged: { path: string };
    };
  }>;
};
