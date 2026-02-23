import { vi, describe, test, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { AudioFile } from "../../shared/types";

// ── audioEngine mock ──────────────────────────────────────────────────────────

const { mockPlay, mockStop, mockSeek } = vi.hoisted(() => ({
  mockPlay: vi.fn().mockResolvedValue(undefined),
  mockStop: vi.fn(),
  mockSeek: vi.fn(),
}));

vi.mock("../services/audioEngine", () => ({
  audioEngine: { play: mockPlay, stop: mockStop, seek: mockSeek },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useKeyboardNav } from "./useKeyboardNav";
import { useBrowserStore } from "../stores/browserStore";
import { usePlaybackStore } from "../stores/playbackStore";
import { useSettingsStore } from "../stores/settingsStore";

// ── Helpers ───────────────────────────────────────────────────────────────────

const files: AudioFile[] = [
  { path: "/S/a.wav", name: "a.wav", extension: ".wav", size: 100 },
  { path: "/S/b.wav", name: "b.wav", extension: ".wav", size: 100 },
  { path: "/S/c.wav", name: "c.wav", extension: ".wav", size: 100 },
];

const press = (key: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });

const resetStores = () => {
  useBrowserStore.setState({
    activeFolder: "/S",
    fileList: files,
    selectedIndex: 1, // start at middle
    sortKey: "name",
    sortDir: "asc",
    filter: "",
  });
  usePlaybackStore.setState({
    currentFile: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    loop: false,
    volume: 1,
  });
  useSettingsStore.setState({
    pinnedFolders: [],
    autoplay: false,
    normalizeVolume: false,
    normalizationTargetLufs: -14,
    sidebarWidth: 220,
    detailPanelWidth: 300,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  resetStores();
});

describe("useKeyboardNav", () => {
  test("ArrowDown calls selectNext()", () => {
    renderHook(() => useKeyboardNav());
    press("ArrowDown");
    expect(useBrowserStore.getState().selectedIndex).toBe(2);
  });

  test("ArrowUp calls selectPrev()", () => {
    renderHook(() => useKeyboardNav());
    press("ArrowUp");
    expect(useBrowserStore.getState().selectedIndex).toBe(0);
  });

  test("ArrowLeft calls selectPrev()", () => {
    renderHook(() => useKeyboardNav());
    press("ArrowLeft");
    expect(useBrowserStore.getState().selectedIndex).toBe(0);
  });

  test("Space while not playing and file selected calls audioEngine.play()", () => {
    renderHook(() => useKeyboardNav());
    press(" ");
    expect(mockPlay).toHaveBeenCalledOnce();
    expect(mockPlay).toHaveBeenCalledWith(files[1], expect.any(Array));
  });

  test("Space while playing calls audioEngine.stop()", () => {
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), isPlaying: true, currentFile: files[1] });
    renderHook(() => useKeyboardNav());
    press(" ");
    expect(mockStop).toHaveBeenCalledOnce();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  test("Escape calls audioEngine.stop()", () => {
    renderHook(() => useKeyboardNav());
    press("Escape");
    expect(mockStop).toHaveBeenCalledOnce();
  });

  test("ArrowRight calls audioEngine.seek(0) and play", () => {
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), currentFile: files[1] });
    renderHook(() => useKeyboardNav());
    press("ArrowRight");
    expect(mockSeek).toHaveBeenCalledWith(0);
    expect(mockPlay).toHaveBeenCalledWith(files[1], expect.any(Array));
  });

  test("navigation with autoplay on calls audioEngine.play() with new file", () => {
    useSettingsStore.setState({ ...useSettingsStore.getState(), autoplay: true });
    renderHook(() => useKeyboardNav());
    press("ArrowDown");
    expect(mockPlay).toHaveBeenCalledOnce();
    expect(mockPlay).toHaveBeenCalledWith(files[2], expect.any(Array));
  });

  test("navigation with autoplay off does not call audioEngine.play()", () => {
    renderHook(() => useKeyboardNav());
    press("ArrowDown");
    expect(mockPlay).not.toHaveBeenCalled();
  });

  test("removes keydown listener on unmount", () => {
    const { unmount } = renderHook(() => useKeyboardNav());
    unmount();
    press("Escape");
    expect(mockStop).not.toHaveBeenCalled();
  });

  test("does not intercept keys typed in an input element", () => {
    renderHook(() => useKeyboardNav());
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(mockStop).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
