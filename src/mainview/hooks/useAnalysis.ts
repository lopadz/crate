import { useEffect } from "react";
import type { CrateRPC } from "../../shared/types";
import { useAnalysisStore } from "../stores/analysisStore";
import { useBrowserStore } from "../stores/browserStore";

type AnalysisResultDetail = CrateRPC["webview"]["messages"]["analysisResult"];

/**
 * Subscribes to `crate:analysisResult` CustomEvents pushed from the main
 * process and updates both the analysisStore (status) and browserStore
 * (file metadata) on each result.
 */
export function useAnalysis() {
  const setFileStatus = useAnalysisStore((s) => s.setFileStatus);
  const updateFileAnalysis = useBrowserStore((s) => s.updateFileAnalysis);

  useEffect(() => {
    function handleResult(event: Event) {
      const data = (event as CustomEvent<AnalysisResultDetail>).detail;
      updateFileAnalysis(data.compositeId, data);
      setFileStatus(data.compositeId, "done");
    }

    window.addEventListener("crate:analysisResult", handleResult);
    return () => {
      window.removeEventListener("crate:analysisResult", handleResult);
    };
  }, [setFileStatus, updateFileAnalysis]);
}
