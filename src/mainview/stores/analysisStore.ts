import { create } from "zustand";

export type FileAnalysisStatus = "queued" | "done" | "error";

interface AnalysisState {
  queueStatus: { pending: number; running: number; total: number };
  fileStatuses: Record<string, FileAnalysisStatus>;

  setQueueStatus: (status: {
    pending: number;
    running: number;
    total: number;
  }) => void;
  setFileStatus: (compositeId: string, status: FileAnalysisStatus) => void;
  setFileStatuses: (statuses: Record<string, FileAnalysisStatus>) => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  queueStatus: { pending: 0, running: 0, total: 0 },
  fileStatuses: {},

  setQueueStatus: (status) => set({ queueStatus: status }),

  setFileStatus: (compositeId, status) =>
    set((state) => ({
      fileStatuses: { ...state.fileStatuses, [compositeId]: status },
    })),

  setFileStatuses: (statuses) =>
    set((state) => ({
      fileStatuses: { ...state.fileStatuses, ...statuses },
    })),
}));
