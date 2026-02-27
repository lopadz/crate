import { rpcClient } from "../rpc";

export const collectionsApi = {
  /** Fetch all collections. */
  getAll: () => rpcClient?.request.collectionGetAll({}),

  /** Fetch the files belonging to a collection. */
  getFiles: (collectionId: number) => rpcClient?.request.collectionGetFiles({ collectionId }),

  /** Create a new collection. */
  create: (name: string, color: string | null, queryJson: string | null) =>
    rpcClient?.request.collectionCreate({ name, color, queryJson }),

  /** Delete a collection. Fire-and-forget. */
  delete: (collectionId: number) => rpcClient?.send.collectionDelete({ collectionId }),
};
