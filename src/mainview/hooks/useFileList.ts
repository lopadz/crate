import { useEffect } from "react";
import { filesApi } from "../api/files";
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

    const scanFiles = (files: Parameters<typeof setFileList>[0]) => {
      for (const f of files) {
        if (!f.compositeId || f.lufsIntegrated != null) continue;
        filesApi.queueFile(f.compositeId, f.path);
      }
    };

    filesApi.readdir(activeFolder)?.then((files) => {
      if (!cancelled) {
        loadFiles(files);
        scanFiles(files);
      }
    });

    filesApi.startWatch(activeFolder);

    const handleChange = (e: Event) => {
      const { path } = (e as CustomEvent<{ path: string }>).detail;
      if (path === activeFolder) {
        filesApi.readdir(activeFolder)?.then((files) => {
          if (!cancelled) {
            loadFiles(files);
            scanFiles(files);
          }
        });
      }
    };

    window.addEventListener("crate:directoryChanged", handleChange);

    return () => {
      cancelled = true;
      filesApi.stopWatch(activeFolder);
      window.removeEventListener("crate:directoryChanged", handleChange);
    };
  }, [activeFolder, setFileList]);
}
