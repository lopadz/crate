import { useEffect } from "react";
import type { AudioFile, TagColor } from "../../shared/types";
import { rpcClient } from "../rpc";
import { audioEngine } from "../services/audioEngine";
import { midiEngine } from "../services/midiEngine";
import { useAnalysisStore } from "../stores/analysisStore";
import { useBrowserStore } from "../stores/browserStore";
import { usePlaybackStore } from "../stores/playbackStore";
import { useSettingsStore } from "../stores/settingsStore";

function isMidi(file: AudioFile): boolean {
  return file.extension === ".mid" || file.extension === ".midi";
}

function getNeighbors(fileList: AudioFile[], index: number): AudioFile[] {
  return [fileList[index - 1], fileList[index + 1]].filter(Boolean);
}

function findNextSelectable(
  fileList: AudioFile[],
  fromIndex: number,
  direction: 1 | -1,
): number {
  const { fileStatuses } = useAnalysisStore.getState();
  let idx = fromIndex + direction;
  while (idx >= 0 && idx < fileList.length) {
    const f = fileList[idx];
    if ((f.compositeId ? fileStatuses[f.compositeId] : undefined) !== "queued")
      return idx;
    idx += direction;
  }
  return fromIndex;
}

export function useKeyboardNav(): void {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept when user is typing
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      )
        return;

      const { fileList, selectedIndex, setSelectedIndex } =
        useBrowserStore.getState();
      const { isPlaying, currentFile } = usePlaybackStore.getState();
      const { autoplay } = useSettingsStore.getState();

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIdx = findNextSelectable(fileList, selectedIndex, 1);
          if (nextIdx !== selectedIndex) {
            setSelectedIndex(nextIdx);
            if (autoplay) {
              const nextFile = fileList[nextIdx];
              if (nextFile)
                audioEngine.play(nextFile, getNeighbors(fileList, nextIdx));
            }
          }
          break;
        }

        case "ArrowUp":
        case "ArrowLeft": {
          e.preventDefault();
          const prevIdx = findNextSelectable(fileList, selectedIndex, -1);
          if (prevIdx !== selectedIndex) {
            setSelectedIndex(prevIdx);
            if (autoplay) {
              const prevFile = fileList[prevIdx];
              if (prevFile)
                audioEngine.play(prevFile, getNeighbors(fileList, prevIdx));
            }
          }
          break;
        }

        case " ": {
          e.preventDefault();
          if (isPlaying) {
            if (currentFile && isMidi(currentFile)) midiEngine.stop();
            else audioEngine.stop();
          } else {
            const file = fileList[selectedIndex] ?? currentFile;
            if (file) {
              if (isMidi(file)) midiEngine.play(file);
              else
                audioEngine.play(file, getNeighbors(fileList, selectedIndex));
            }
          }
          break;
        }

        case "Escape": {
          if (currentFile && isMidi(currentFile)) midiEngine.stop();
          else audioEngine.stop();
          break;
        }

        case "ArrowRight": {
          e.preventDefault();
          const file = fileList[selectedIndex] ?? currentFile;
          if (file) {
            audioEngine.seek(0);
            audioEngine.play(file, getNeighbors(fileList, selectedIndex));
          }
          break;
        }

        case "g":
        case "y":
        case "r":
        case "x": {
          if (selectedIndex < 0) break;
          const tagFile = fileList[selectedIndex];
          if (!tagFile?.compositeId) break;
          const color: TagColor =
            e.key === "g"
              ? "green"
              : e.key === "y"
                ? "yellow"
                : e.key === "r"
                  ? "red"
                  : null;
          useBrowserStore.getState().setColorTag(tagFile.compositeId, color);
          rpcClient?.send.dbSetColorTag({
            compositeId: tagFile.compositeId,
            color,
          });
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
}
