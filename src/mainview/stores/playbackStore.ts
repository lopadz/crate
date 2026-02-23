import { create } from "zustand";
import type { AudioFile } from "../../shared/types";

interface PlaybackState {
  currentFile: AudioFile | null;
  isPlaying: boolean;
  position: number; // seconds
  duration: number; // seconds
  loop: boolean;
  volume: number; // 0–1

  setCurrentFile: (file: AudioFile | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setPosition: (pos: number) => void;
  setDuration: (dur: number) => void;
  toggleLoop: () => void;
  setVolume: (vol: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentFile: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  loop: false,
  volume: 1,

  setCurrentFile: (file) =>
    set({ currentFile: file, position: file === null ? 0 : get().position }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setPosition: (pos) => set({ position: pos }),

  setDuration: (dur) => set({ duration: dur }),

  toggleLoop: () => set((s) => ({ loop: !s.loop })),

  setVolume: (vol) => set({ volume: Math.min(1, Math.max(0, vol)) }),
}));
