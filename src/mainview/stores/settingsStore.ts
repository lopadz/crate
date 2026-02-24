import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  pinnedFolders: string[];
  autoplay: boolean;
  normalizeVolume: boolean;
  normalizationTargetLufs: number;
  sidebarWidth: number;
  detailPanelWidth: number;
  dragPattern: string;

  setPinnedFolders: (folders: string[]) => void;
  addPinnedFolder: (path: string) => void;
  removePinnedFolder: (path: string) => void;
  setAutoplay: (autoplay: boolean) => void;
  toggleNormalizeVolume: () => void;
  setSidebarWidth: (w: number) => void;
  setDetailPanelWidth: (w: number) => void;
  setDragPattern: (pattern: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      pinnedFolders: [],
      autoplay: false,
      normalizeVolume: false,
      normalizationTargetLufs: -14,
      sidebarWidth: 220,
      detailPanelWidth: 300,
      dragPattern: "{original}",

      setPinnedFolders: (folders) => set({ pinnedFolders: folders }),

      addPinnedFolder: (path) => {
        if (get().pinnedFolders.includes(path)) return;
        set((s) => ({ pinnedFolders: [...s.pinnedFolders, path] }));
      },

      removePinnedFolder: (path) =>
        set((s) => ({
          pinnedFolders: s.pinnedFolders.filter((p) => p !== path),
        })),

      setAutoplay: (autoplay) => set({ autoplay }),

      toggleNormalizeVolume: () =>
        set((s) => ({ normalizeVolume: !s.normalizeVolume })),

      setSidebarWidth: (w) => set({ sidebarWidth: w }),

      setDetailPanelWidth: (w) => set({ detailPanelWidth: w }),

      setDragPattern: (pattern) => set({ dragPattern: pattern }),
    }),
    { name: "crate-settings" },
  ),
);
