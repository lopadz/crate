import type { AudioFile } from "../../shared/types";
import { useSettingsStore } from "../stores/settingsStore";
import { getPrewarmedPath } from "./useDragCopyPrewarm";

/**
 * Provides drag-and-drop behaviour for audio files.
 *
 * Uses the pre-warmed temp path from useDragCopyPrewarm when available
 * (renamed copy with the configured drag pattern). Falls back to the
 * original file path when the cache hasn't warmed yet.
 */
export function useDragDrop(file: AudioFile) {
  const dragPattern = useSettingsStore((s) => s.dragPattern);

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "copy";

    const prewarmedPath = file.compositeId
      ? getPrewarmedPath(file.compositeId, dragPattern)
      : null;

    const filePath = prewarmedPath ?? file.path;
    e.dataTransfer.setData("text/uri-list", `file://${filePath}`);
    e.dataTransfer.setData("text/plain", filePath);
  };

  return { onDragStart };
}
