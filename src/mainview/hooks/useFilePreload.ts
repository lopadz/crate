import { useEffect } from "react";
import { audioEngine } from "../services/audioEngine";
import { useBrowserStore } from "../stores/browserStore";

/**
 * Subscribes to selectedIndex changes and fires audioEngine.preload() so the
 * audio buffer and blob URL are ready before the user presses play.
 */
export function useFilePreload(): void {
  useEffect(() => {
    return useBrowserStore.subscribe((state, prevState) => {
      if (
        state.selectedIndex !== prevState.selectedIndex &&
        state.selectedIndex >= 0
      ) {
        const file = state.fileList[state.selectedIndex];
        if (file) audioEngine.preload(file);
      }
    });
  }, []);
}
