import { create } from "zustand";
import type { AudioFile, TagColor } from "../../shared/types";

type SortKey = "name" | "size" | "duration";
type SortDir = "asc" | "desc";

interface SessionFilter {
  bpm: number | null;
  key: string | null;
}

interface BrowserState {
  activeFolder: string | null;
  fileList: AudioFile[];
  selectedIndex: number;
  sortKey: SortKey;
  sortDir: SortDir;
  filter: string;
  sessionFilter: SessionFilter;

  setActiveFolder: (path: string | null) => void;
  setFileList: (files: AudioFile[]) => void;
  setSelectedIndex: (index: number) => void;
  selectNext: () => void;
  selectPrev: () => void;
  setSortKey: (key: SortKey) => void;
  setSortDir: (dir: SortDir) => void;
  setFilter: (filter: string) => void;
  setSessionFilter: (filter: SessionFilter) => void;
  setColorTag: (compositeId: string, color: TagColor) => void;
  updateFileAnalysis: (
    compositeId: string,
    data: {
      bpm: number | null;
      key: string | null;
      keyCamelot: string | null;
      lufsIntegrated: number;
      lufsPeak: number;
      dynamicRange: number;
    },
  ) => void;
}

export const useBrowserStore = create<BrowserState>((set, get) => ({
  activeFolder: null,
  fileList: [],
  selectedIndex: -1,
  sortKey: "name",
  sortDir: "asc",
  filter: "",
  sessionFilter: { bpm: null, key: null },

  setActiveFolder: (path) => set({ activeFolder: path }),

  setFileList: (files) => set({ fileList: files, selectedIndex: -1 }),

  setSelectedIndex: (index) => set({ selectedIndex: index }),

  selectNext: () => {
    const { selectedIndex, fileList } = get();
    const next = Math.min(selectedIndex + 1, fileList.length - 1);
    set({ selectedIndex: next });
  },

  selectPrev: () => {
    const { selectedIndex } = get();
    const prev = Math.max(selectedIndex - 1, 0);
    set({ selectedIndex: prev });
  },

  setSortKey: (key) => set({ sortKey: key }),

  setSortDir: (dir) => set({ sortDir: dir }),

  setFilter: (filter) => set({ filter }),

  setSessionFilter: (filter) => set({ sessionFilter: filter }),

  setColorTag: (compositeId, color) =>
    set((state) => ({
      fileList: state.fileList.map((f) =>
        f.compositeId === compositeId ? { ...f, colorTag: color } : f,
      ),
    })),

  updateFileAnalysis: (compositeId, data) =>
    set((state) => ({
      fileList: state.fileList.map((f) =>
        f.compositeId === compositeId
          ? {
              ...f,
              bpm: data.bpm ?? undefined,
              key: data.key ?? undefined,
              keyCamelot: data.keyCamelot ?? undefined,
              lufsIntegrated: data.lufsIntegrated,
              lufsPeak: data.lufsPeak,
              dynamicRange: data.dynamicRange,
            }
          : f,
      ),
    })),
}));
