import { useEffect } from "react";
import { rpcClient } from "../rpc";
import { useBrowserStore } from "../stores/browserStore";

export function useFileList() {
  const activeFolder = useBrowserStore((s) => s.activeFolder);
  const setFileList = useBrowserStore((s) => s.setFileList);

  useEffect(() => {
    if (!activeFolder) return;

    let cancelled = false;

    rpcClient?.request.fsReaddir({ path: activeFolder }).then((files) => {
      if (!cancelled) setFileList(files);
    });

    rpcClient?.send.fsStartWatch({ path: activeFolder });

    const handleChange = (e: Event) => {
      const { path } = (e as CustomEvent<{ path: string }>).detail;
      if (path === activeFolder) {
        rpcClient?.request.fsReaddir({ path: activeFolder }).then((files) => {
          if (!cancelled) setFileList(files);
        });
      }
    };

    window.addEventListener("crate:directoryChanged", handleChange);

    return () => {
      cancelled = true;
      rpcClient?.send.fsStopWatch({ path: activeFolder });
      window.removeEventListener("crate:directoryChanged", handleChange);
    };
  }, [activeFolder, setFileList]);
}
