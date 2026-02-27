import { rpcClient } from "../rpc";

export const filesApi = {
  /** Read directory contents. */
  readdir: (path: string) => rpcClient?.request.fsReaddir({ path }),

  /** Full-text search across files. */
  search: (query: string) => rpcClient?.request.dbSearchFiles({ query }),

  /** Start watching a directory for changes. Fire-and-forget. */
  startWatch: (path: string) => rpcClient?.send.fsStartWatch({ path }),

  /** Stop watching a directory. Fire-and-forget. */
  stopWatch: (path: string) => rpcClient?.send.fsStopWatch({ path }),

  /** Enqueue a file for BPM/key/LUFS analysis. Fire-and-forget. */
  queueFile: (compositeId: string, path: string) =>
    rpcClient?.send.analysisQueueFile({ compositeId, path }),
};
