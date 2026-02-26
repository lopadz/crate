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

function findNextSelectable(fileList: AudioFile[], fromIndex: number, direction: 1 | -1): number {
  const { fileStatuses } = useAnalysisStore.getState();
  let idx = fromIndex + direction;
  while (idx >= 0 && idx < fileList.length) {
    const f = fileList[idx];
    if ((f.compositeId ? fileStatuses[f.compositeId] : undefined) !== "queued") return idx;
    idx += direction;
  }
  return fromIndex;
}

function handleNavigate(e: KeyboardEvent, direction: 1 | -1): void {
  e.preventDefault();
  const { fileList, selectedIndex, setSelectedIndex } = useBrowserStore.getState();
  const { autoplay } = useSettingsStore.getState();
  const nextIdx = findNextSelectable(fileList, selectedIndex, direction);
  if (nextIdx === selectedIndex) return;
  setSelectedIndex(nextIdx);
  if (autoplay) {
    const nextFile = fileList[nextIdx];
    if (nextFile) audioEngine.play(nextFile, getNeighbors(fileList, nextIdx));
  }
}

function handleSpace(e: KeyboardEvent): void {
  e.preventDefault();
  const { fileList, selectedIndex } = useBrowserStore.getState();
  const { isPlaying, currentFile } = usePlaybackStore.getState();
  if (isPlaying) {
    if (currentFile && isMidi(currentFile)) midiEngine.stop();
    else audioEngine.pause();
    return;
  }
  const file = fileList[selectedIndex] ?? currentFile;
  if (!file) return;
  if (isMidi(file)) midiEngine.play(file);
  else audioEngine.play(file, getNeighbors(fileList, selectedIndex));
}

function handleEscape(): void {
  const { currentFile } = usePlaybackStore.getState();
  if (currentFile && isMidi(currentFile)) midiEngine.stop();
  else audioEngine.stop();
}

function handleArrowRight(e: KeyboardEvent): void {
  e.preventDefault();
  const { fileList, selectedIndex } = useBrowserStore.getState();
  const { currentFile } = usePlaybackStore.getState();
  const file = fileList[selectedIndex] ?? currentFile;
  if (!file) return;
  audioEngine.seek(0);
  audioEngine.play(file, getNeighbors(fileList, selectedIndex));
}

function handleColorTag(key: string): void {
  const { fileList, selectedIndex } = useBrowserStore.getState();
  if (selectedIndex < 0) return;
  const tagFile = fileList[selectedIndex];
  if (!tagFile?.compositeId) return;
  const color: TagColor =
    key === "g" ? "green" : key === "y" ? "yellow" : key === "r" ? "red" : null;
  useBrowserStore.getState().setColorTag(tagFile.compositeId, color);
  rpcClient?.send.dbSetColorTag({ compositeId: tagFile.compositeId, color });
}

export function useKeyboardNav(): void {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case "ArrowDown":
          handleNavigate(e, 1);
          break;
        case "ArrowUp":
        case "ArrowLeft":
          handleNavigate(e, -1);
          break;
        case " ":
          handleSpace(e);
          break;
        case "Escape":
          handleEscape();
          break;
        case "ArrowRight":
          handleArrowRight(e);
          break;
        case "g":
        case "y":
        case "r":
        case "x":
          handleColorTag(e.key);
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
}
