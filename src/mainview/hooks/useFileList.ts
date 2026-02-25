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
      // Build all statuses in one pass and apply as a single store update
      // to avoid N individual re-renders for large directories.
      const statuses: Record<string, "queued" | "done"> = {};
      for (const f of files) {
        if (!f.compositeId) continue;
        statuses[f.compositeId] = f.lufsIntegrated != null ? "done" : "queued";
      }
      useAnalysisStore.getState().setFileStatuses(statuses);
    };

    const scanFiles = async (files: Parameters<typeof setFileList>[0]) => {
      // Yield once so the file list renders before we finalize statuses.
      // Real analysis (BPM/key/LUFS) will happen in the backend worker;
      // for now mark all queued files done in a single bulk update.
      await new Promise<void>((r) => setTimeout(r, 0));
      if (cancelled) return;
      const updates: Record<string, "done"> = {};
      for (const f of files) {
        if (!f.compositeId || f.lufsIntegrated != null) continue;
        updates[f.compositeId] = "done";
      }
      if (Object.keys(updates).length > 0) {
        useAnalysisStore.getState().setFileStatuses(updates);
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
