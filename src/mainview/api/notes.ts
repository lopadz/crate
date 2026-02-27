import { rpcClient } from "../rpc";

export const notesApi = {
  /** Fetch the note for a file. Returns empty string when no note exists. */
  getNote: (compositeId: string) =>
    rpcClient?.request.dbGetNote({ compositeId }).then((note) => note ?? ""),

  /** Persist a note. Fire-and-forget. */
  setNote: (compositeId: string, content: string) =>
    rpcClient?.send.dbSetNote({ compositeId, content }),
};
