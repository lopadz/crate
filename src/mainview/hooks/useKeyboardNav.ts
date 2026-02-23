import { useEffect } from "react";
import type { AudioFile } from "../../shared/types";
import { useBrowserStore } from "../stores/browserStore";
import { usePlaybackStore } from "../stores/playbackStore";
import { useSettingsStore } from "../stores/settingsStore";
import { audioEngine } from "../services/audioEngine";

function getNeighbors(fileList: AudioFile[], index: number): AudioFile[] {
  return [fileList[index - 1], fileList[index + 1]].filter(Boolean);
}

export function useKeyboardNav(): void {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept when user is typing
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      const { fileList, selectedIndex, selectNext, selectPrev } = useBrowserStore.getState();
      const { isPlaying, currentFile } = usePlaybackStore.getState();
      const { autoplay } = useSettingsStore.getState();

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          selectNext();
          if (autoplay) {
            const nextIdx = Math.min(selectedIndex + 1, fileList.length - 1);
            const nextFile = fileList[nextIdx];
            if (nextFile) audioEngine.play(nextFile, getNeighbors(fileList, nextIdx));
          }
          break;
        }

        case "ArrowUp":
        case "ArrowLeft": {
          e.preventDefault();
          selectPrev();
          if (autoplay) {
            const prevIdx = Math.max(selectedIndex - 1, 0);
            const prevFile = fileList[prevIdx];
            if (prevFile) audioEngine.play(prevFile, getNeighbors(fileList, prevIdx));
          }
          break;
        }

        case " ": {
          e.preventDefault();
          if (isPlaying) {
            audioEngine.stop();
          } else {
            const file = currentFile ?? fileList[selectedIndex];
            if (file) audioEngine.play(file, getNeighbors(fileList, selectedIndex));
          }
          break;
        }

        case "Escape": {
          audioEngine.stop();
          break;
        }

        case "ArrowRight": {
          e.preventDefault();
          const file = currentFile ?? fileList[selectedIndex];
          if (file) {
            audioEngine.seek(0);
            audioEngine.play(file, getNeighbors(fileList, selectedIndex));
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
}
