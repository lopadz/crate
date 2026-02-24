import { useEffect } from "react";
import { rpcClient } from "../rpc";
import { useAnalysisStore } from "../stores/analysisStore";
import { useBrowserStore } from "../stores/browserStore";

export function useFileList() {
  const activeFolder = useBrowserStore((s) => s.activeFolder);
  const setFileList = useBrowserStore((s) => s.setFileList);

  useEffect(() => {
    if (!activeFolder) return;

    let cancelled = false;

    const loadFiles = (files: Parameters<typeof setFileList>[0]) => {
      setFileList(files);
      const { setFileStatus } = useAnalysisStore.getState();
      for (const f of files) {
        if (!f.compositeId) continue;
        setFileStatus(
          f.compositeId,
          f.lufsIntegrated != null ? "done" : "queued",
        );
      }
    };

    const scanFiles = async (files: Parameters<typeof setFileList>[0]) => {
      const { setFileStatus } = useAnalysisStore.getState();
      for (const f of files) {
        if (cancelled) break;
        if (!f.compositeId || f.lufsIntegrated != null) continue;
        // Yield to the event loop between files so UI stays responsive.
        // Real analysis (BPM/key/LUFS) will run here in a future commit.
        await new Promise<void>((r) => setTimeout(r, 0));
        if (!cancelled && f.compositeId) setFileStatus(f.compositeId, "done");
      }
    };

    rpcClient?.request.fsReaddir({ path: activeFolder }).then((files) => {
      if (!cancelled) {
        loadFiles(files);
        void scanFiles(files);
      }
    });

    rpcClient?.send.fsStartWatch({ path: activeFolder });

    const handleChange = (e: Event) => {
      const { path } = (e as CustomEvent<{ path: string }>).detail;
      if (path === activeFolder) {
        rpcClient?.request.fsReaddir({ path: activeFolder }).then((files) => {
          if (!cancelled) {
            loadFiles(files);
            void scanFiles(files);
          }
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
