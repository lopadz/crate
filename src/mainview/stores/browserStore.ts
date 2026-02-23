import { create } from "zustand";
import type { AudioFile } from "../../shared/types";

type SortKey = "name" | "size" | "duration";
type SortDir = "asc" | "desc";

interface BrowserState {
  activeFolder: string | null;
  fileList: AudioFile[];
  selectedIndex: number;
  sortKey: SortKey;
  sortDir: SortDir;
  filter: string;

  setActiveFolder: (path: string | null) => void;
  setFileList: (files: AudioFile[]) => void;
  setSelectedIndex: (index: number) => void;
  selectNext: () => void;
  selectPrev: () => void;
  setSortKey: (key: SortKey) => void;
  setSortDir: (dir: SortDir) => void;
  setFilter: (filter: string) => void;
}

export const useBrowserStore = create<BrowserState>((set, get) => ({
  activeFolder: null,
  fileList: [],
  selectedIndex: -1,
  sortKey: "name",
  sortDir: "asc",
  filter: "",

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
}));
