import type { Tag } from "../../shared/types";
import { rpcClient } from "../rpc";

export const tagsApi = {
  /** Fetch all tags in the library. */
  getAll: () => rpcClient?.request.dbGetAllTags({}),

  /** Fetch the tags applied to a specific file. */
  getForFile: (compositeId: string) =>
    rpcClient?.request.dbGetFileTags({ compositeId }),

  /** Create a new tag and return it. */
  create: (name: string) =>
    rpcClient?.request.dbCreateTag({ name, color: null }),

  /** Apply an existing tag to a file. Fire-and-forget. */
  addToFile: (compositeId: string, tagId: number) =>
    rpcClient?.send.dbAddFileTag({ compositeId, tagId }),

  /** Remove a tag from a file. Fire-and-forget. */
  removeFromFile: (compositeId: string, tagId: number) =>
    rpcClient?.send.dbRemoveFileTag({ compositeId, tagId }),
};
