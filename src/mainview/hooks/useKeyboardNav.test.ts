import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";

// ── audioEngine mock ──────────────────────────────────────────────────────────

const { mockPlay, mockPause, mockStop, mockSeek, mockDbSetColorTag, mockMidiPlay, mockMidiStop } =
  vi.hoisted(() => ({
    mockPlay: vi.fn().mockResolvedValue(undefined),
    mockPause: vi.fn(),
    mockStop: vi.fn(),
    mockSeek: vi.fn(),
    mockDbSetColorTag: vi.fn(),
    mockMidiPlay: vi.fn().mockResolvedValue(undefined),
    mockMidiStop: vi.fn(),
  }));

vi.mock("../services/audioEngine", () => ({
  audioEngine: { play: mockPlay, pause: mockPause, stop: mockStop, seek: mockSeek },
}));

vi.mock("../services/midiEngine", () => ({
  midiEngine: { play: mockMidiPlay, stop: mockMidiStop },
}));

vi.mock("../rpc", () => ({
  rpcClient: {
    send: { dbSetColorTag: mockDbSetColorTag },
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useAnalysisStore } from "../stores/analysisStore";
import { useBrowserStore } from "../stores/browserStore";
import { usePlaybackStore } from "../stores/playbackStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useKeyboardNav } from "./useKeyboardNav";

// ── Helpers ───────────────────────────────────────────────────────────────────

const files: AudioFile[] = [
  {
    path: "/S/a.wav",
    name: "a.wav",
    extension: ".wav",
    size: 100,
    compositeId: "cid-a",
  },
  {
    path: "/S/b.wav",
    name: "b.wav",
    extension: ".wav",
    size: 100,
    compositeId: "cid-b",
  },
  {
    path: "/S/c.wav",
    name: "c.wav",
    extension: ".wav",
    size: 100,
    compositeId: "cid-c",
  },
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
  useAnalysisStore.setState({
    queueStatus: { pending: 0, running: 0, total: 0 },
    fileStatuses: {},
  });
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

  test("Space plays the selected file, not currentFile, when selection has changed", () => {
    // currentFile is files[0] but user has navigated to files[2]
    usePlaybackStore.setState({
      ...usePlaybackStore.getState(),
      currentFile: files[0],
      isPlaying: false,
    });
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      selectedIndex: 2,
    });
    renderHook(() => useKeyboardNav());
    press(" ");
    expect(mockPlay).toHaveBeenCalledWith(files[2], expect.any(Array));
  });

  test("Space while playing calls audioEngine.pause()", () => {
    usePlaybackStore.setState({
      ...usePlaybackStore.getState(),
      isPlaying: true,
      currentFile: files[1],
    });
    renderHook(() => useKeyboardNav());
    press(" ");
    expect(mockPause).toHaveBeenCalledOnce();
    expect(mockStop).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  test("Escape calls audioEngine.stop()", () => {
    renderHook(() => useKeyboardNav());
    press("Escape");
    expect(mockStop).toHaveBeenCalledOnce();
  });

  test("ArrowRight calls audioEngine.seek(0) and play", () => {
    usePlaybackStore.setState({
      ...usePlaybackStore.getState(),
      currentFile: files[1],
    });
    renderHook(() => useKeyboardNav());
    press("ArrowRight");
    expect(mockSeek).toHaveBeenCalledWith(0);
    expect(mockPlay).toHaveBeenCalledWith(files[1], expect.any(Array));
  });

  test("navigation with autoplay on calls audioEngine.play() with new file", () => {
    useSettingsStore.setState({
      ...useSettingsStore.getState(),
      autoplay: true,
    });
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

describe("useKeyboardNav — color tag keys", () => {
  test("g sets green tag on selected file", () => {
    renderHook(() => useKeyboardNav());
    press("g");
    expect(mockDbSetColorTag).toHaveBeenCalledWith({
      compositeId: files[1].compositeId,
      color: "green",
    });
    expect(useBrowserStore.getState().fileList[1].colorTag).toBe("green");
  });

  test("y sets yellow tag on selected file", () => {
    renderHook(() => useKeyboardNav());
    press("y");
    expect(mockDbSetColorTag).toHaveBeenCalledWith({
      compositeId: files[1].compositeId,
      color: "yellow",
    });
    expect(useBrowserStore.getState().fileList[1].colorTag).toBe("yellow");
  });

  test("r sets red tag on selected file", () => {
    renderHook(() => useKeyboardNav());
    press("r");
    expect(mockDbSetColorTag).toHaveBeenCalledWith({
      compositeId: files[1].compositeId,
      color: "red",
    });
    expect(useBrowserStore.getState().fileList[1].colorTag).toBe("red");
  });

  test("x clears tag on selected file", () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      fileList: [files[0], { ...files[1], colorTag: "green" }, files[2]],
    });
    renderHook(() => useKeyboardNav());
    press("x");
    expect(mockDbSetColorTag).toHaveBeenCalledWith({
      compositeId: files[1].compositeId,
      color: null,
    });
    expect(useBrowserStore.getState().fileList[1].colorTag).toBeNull();
  });

  test("tag keys do nothing when no file is selected (index -1)", () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      selectedIndex: -1,
    });
    renderHook(() => useKeyboardNav());
    press("g");
    expect(mockDbSetColorTag).not.toHaveBeenCalled();
  });
});

describe("useKeyboardNav — MIDI routing", () => {
  const midiFile: AudioFile = {
    path: "/S/beat.mid",
    name: "beat.mid",
    extension: ".mid",
    size: 500,
  };

  beforeEach(() => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      fileList: [files[0], midiFile, files[2]],
      selectedIndex: 1, // MIDI file selected
    });
  });

  test("Space with MIDI file selected calls midiEngine.play()", () => {
    renderHook(() => useKeyboardNav());
    press(" ");
    expect(mockMidiPlay).toHaveBeenCalledWith(midiFile);
    expect(mockPlay).not.toHaveBeenCalled();
  });

  test("Space while MIDI is playing calls midiEngine.stop()", () => {
    usePlaybackStore.setState({
      ...usePlaybackStore.getState(),
      isPlaying: true,
      currentFile: midiFile,
    });
    renderHook(() => useKeyboardNav());
    press(" ");
    expect(mockMidiStop).toHaveBeenCalledOnce();
    expect(mockStop).not.toHaveBeenCalled();
  });

  test("Escape with MIDI currentFile calls midiEngine.stop()", () => {
    usePlaybackStore.setState({
      ...usePlaybackStore.getState(),
      isPlaying: true,
      currentFile: midiFile,
    });
    renderHook(() => useKeyboardNav());
    press("Escape");
    expect(mockMidiStop).toHaveBeenCalledOnce();
    expect(mockStop).not.toHaveBeenCalled();
  });

  test("Space with .wav file selected still calls audioEngine.play()", () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      selectedIndex: 0,
    });
    renderHook(() => useKeyboardNav());
    press(" ");
    expect(mockPlay).toHaveBeenCalledOnce();
    expect(mockMidiPlay).not.toHaveBeenCalled();
  });
});

describe("useKeyboardNav — scanning skip", () => {
  test("ArrowDown skips files whose analysis status is queued", () => {
    // files = [a(0), b(1), c(2)]; b is scanning; start at 0 → should land on 2
    useAnalysisStore.setState({
      ...useAnalysisStore.getState(),
      fileStatuses: { "cid-b": "queued" },
    });
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      selectedIndex: 0,
    });
    renderHook(() => useKeyboardNav());
    press("ArrowDown");
    expect(useBrowserStore.getState().selectedIndex).toBe(2);
  });

  test("ArrowUp skips files whose analysis status is queued", () => {
    // files = [a(0), b(1), c(2)]; b is scanning; start at 2 → should land on 0
    useAnalysisStore.setState({
      ...useAnalysisStore.getState(),
      fileStatuses: { "cid-b": "queued" },
    });
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      selectedIndex: 2,
    });
    renderHook(() => useKeyboardNav());
    press("ArrowUp");
    expect(useBrowserStore.getState().selectedIndex).toBe(0);
  });

  test("ArrowDown stays put when all remaining files are scanning", () => {
    useAnalysisStore.setState({
      ...useAnalysisStore.getState(),
      fileStatuses: { "cid-b": "queued", "cid-c": "queued" },
    });
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      selectedIndex: 0,
    });
    renderHook(() => useKeyboardNav());
    press("ArrowDown");
    expect(useBrowserStore.getState().selectedIndex).toBe(0);
  });
});
