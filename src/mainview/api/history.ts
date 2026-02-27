import { rpcClient } from "../rpc";

export const historyApi = {
  /** Fetch the most-recently-played files. */
  getRecent: (limit: number) => rpcClient?.request.dbGetPlayHistory({ limit }),
};
