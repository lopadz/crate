import { rpcClient } from "../rpc";

export const audioApi = {
  /** Legacy IPC fallback: read audio file as base64. Use HTTP server path when available. */
  readBase64: (path: string) => rpcClient?.request.fsReadAudio({ path }),
};
