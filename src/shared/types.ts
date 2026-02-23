// Shared RPC type definitions for Electrobun IPC.
// Filled out in Commit 4 once db.ts and filesystem.ts are ready.
// Both src/bun/rpc.ts and src/mainview/rpc.ts import from here.

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

// RPC schema placeholder — expanded in Commit 4
export type CrateRPC = {
  bun: Record<string, never>;
  webview: Record<string, never>;
};
