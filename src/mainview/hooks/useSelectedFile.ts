import type { AudioFile } from "../../shared/types";
import { useBrowserStore } from "../stores/browserStore";

/**
 * Returns the currently selected AudioFile, or undefined when nothing is selected
 * or the index is out of bounds. Reactively updates on fileList or selectedIndex changes.
 */
export function useSelectedFile(): AudioFile | undefined {
  const fileList = useBrowserStore((s) => s.fileList);
  const selectedIndex = useBrowserStore((s) => s.selectedIndex);
  return selectedIndex >= 0 ? fileList[selectedIndex] : undefined;
}
