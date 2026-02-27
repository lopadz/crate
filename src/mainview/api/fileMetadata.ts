import type { TagColor } from "../../shared/types";
import { rpcClient } from "../rpc";

export const fileMetadataApi = {
  /** Set the star rating (0–5) for a file. Fire-and-forget. */
  setRating: (compositeId: string, value: number) =>
    rpcClient?.send.dbSetRating({ compositeId, value }),

  /** Set the colour label for a file. Fire-and-forget. */
  setColorTag: (compositeId: string, color: TagColor) =>
    rpcClient?.send.dbSetColorTag({ compositeId, color }),
};
