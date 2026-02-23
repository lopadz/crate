import { Electroview } from "electrobun/view";
import type { CrateRPC } from "../shared/types";

// Handles messages pushed FROM the main process to the renderer.
// Dispatches a CustomEvent so React components can react without a direct
// dependency on this module.
const rpc = Electroview.defineRPC<CrateRPC>({
  handlers: {
    requests: {},
    messages: {
      fsDirectoryChanged: ({ path }) => {
        window.dispatchEvent(
          new CustomEvent("crate:directoryChanged", { detail: { path } }),
        );
      },
    },
  },
});

export const electroview = new Electroview({ rpc });

// Convenience re-export so callers don't need to import electroview directly.
// Usage: import { rpcClient } from "./rpc"
//        const files = await rpcClient.request.fsReaddir({ path })
export const rpcClient = electroview.rpc;
