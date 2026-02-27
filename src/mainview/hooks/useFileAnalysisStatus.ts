import { type FileAnalysisStatus, useAnalysisStore } from "../stores/analysisStore";

/**
 * Returns the FileAnalysisStatus for the given compositeId, or undefined when
 * the id is absent or has no recorded status. Reactively updates as analysis progresses.
 */
export function useFileAnalysisStatus(
  compositeId: string | undefined,
): FileAnalysisStatus | undefined {
  return useAnalysisStore((s) => (compositeId ? s.fileStatuses[compositeId] : undefined));
}
