import { rpcClient } from "../rpc";

export const dawApi = {
  /** Pre-create a renamed temp copy of a file for drag-and-drop. */
  createDragCopy: (args: {
    path: string;
    pattern: string;
    bpm: number | null | undefined;
    key: string | null | undefined;
    keyCamelot: string | null | undefined;
  }) => rpcClient?.request.dawCreateDragCopy(args),
};
