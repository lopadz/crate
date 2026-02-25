import { useEffect } from "react";
import { rpcClient } from "../rpc";
import { useBrowserStore } from "../stores/browserStore";
import { useSettingsStore } from "../stores/settingsStore";

interface PrewarmEntry {
  compositeId: string;
  pattern: string;
  tempPath: string;
}

// Single-entry cache: the most recently pre-warmed file+pattern combination.
let cache: PrewarmEntry | null = null;

/** Returns the pre-warmed temp path if compositeId + pattern match, else null. */
export function getPrewarmedPath(compositeId: string, pattern: string): string | null {
  if (cache?.compositeId === compositeId && cache?.pattern === pattern) {
    return cache.tempPath;
  }
  return null;
}

/** Clears the cache. Exported for test isolation only. */
export function resetPrewarmCache(): void {
  cache = null;
}

/**
 * Watches the active file and drag pattern. When either changes, silently
 * pre-creates a renamed temp copy so it is ready before the user starts
 * dragging (avoiding the web API limitation where dataTransfer is only
 * writable during the synchronous dragstart event).
 *
 * Call this hook once at the App level alongside useFilePreload.
 */
export function useDragCopyPrewarm(): void {
  const fileList = useBrowserStore((s) => s.fileList);
  const selectedIndex = useBrowserStore((s) => s.selectedIndex);
  const dragPattern = useSettingsStore((s) => s.dragPattern);

  useEffect(() => {
    const file = selectedIndex >= 0 ? fileList[selectedIndex] : null;
    if (!file?.compositeId) return;

    const { compositeId } = file;

    // Skip if this file+pattern is already cached.
    if (cache?.compositeId === compositeId && cache?.pattern === dragPattern) {
      return;
    }

    cache = null;

    void rpcClient?.request
      .dawCreateDragCopy({
        path: file.path,
        pattern: dragPattern,
        bpm: file.bpm,
        key: file.key,
        keyCamelot: file.keyCamelot,
      })
      .then((tempPath) => {
        cache = { compositeId, pattern: dragPattern, tempPath };
      });
  }, [fileList, selectedIndex, dragPattern]);
}
