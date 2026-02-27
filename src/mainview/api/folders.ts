import { rpcClient } from "../rpc";

export const foldersApi = {
  /** Fetch all pinned folder paths. */
  getPinned: () => rpcClient?.request.dbGetPinnedFolders({}),

  /** Pin a folder path. Fire-and-forget. */
  pin: (path: string) => rpcClient?.send.dbPinFolder({ path }),

  /** Unpin a folder path. Fire-and-forget. */
  unpin: (path: string) => rpcClient?.send.dbUnpinFolder({ path }),

  /** List immediate subdirectories of a folder. */
  listDirs: (path: string) => rpcClient?.request.fsListDirs({ path }),

  /** Open native folder picker dialog; resolves to selected paths. */
  openDialog: () => rpcClient?.request.fsOpenFolderDialog({}),
};
