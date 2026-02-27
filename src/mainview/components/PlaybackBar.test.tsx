import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";
import { useBrowserStore } from "../stores/browserStore";
import { usePlaybackStore } from "../stores/playbackStore";

const { mockPlay, mockStop, mockPause, mockSetLoop, mockSeek, mockGetPosition, mockSetVolume } =
  vi.hoisted(() => ({
    mockPlay: vi.fn().mockResolvedValue(undefined),
    mockStop: vi.fn(),
    mockPause: vi.fn(),
    mockSetLoop: vi.fn(),
    mockSeek: vi.fn(),
    mockGetPosition: vi.fn().mockReturnValue(0),
    mockSetVolume: vi.fn(),
  }));

vi.mock("../services/audioEngine", () => ({
  audioEngine: {
    play: mockPlay,
    stop: mockStop,
    pause: mockPause,
    setLoop: mockSetLoop,
    seek: mockSeek,
    getPosition: mockGetPosition,
    setVolume: mockSetVolume,
  },
}));

import { PlaybackBar } from "./PlaybackBar";

const file: AudioFile = {
  path: "/S/kick.wav",
  name: "kick.wav",
  extension: ".wav",
  size: 1000,
};

beforeEach(() => {
  vi.clearAllMocks();
  usePlaybackStore.setState({
    currentFile: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    loop: false,
    volume: 1,
  });
  useBrowserStore.setState({
    activeFolder: null,
    fileList: [],
    selectedIndex: -1,
    sortKey: "name",
    sortDir: "asc",
    filter: "",
  });
});

describe("PlaybackBar — basic structure", () => {
  test("renders without crashing", () => {
    render(<PlaybackBar />);
  });

  test("has playback-bar test id", () => {
    render(<PlaybackBar />);
    expect(screen.getByTestId("playback-bar")).toBeDefined();
  });
});

describe("PlaybackBar — transport controls", () => {
  test("renders play/pause button", () => {
    render(<PlaybackBar />);
    expect(screen.getByTestId("transport-play-pause")).toBeDefined();
  });

  test("renders stop button", () => {
    render(<PlaybackBar />);
    expect(screen.getByTestId("transport-stop")).toBeDefined();
  });

  test("clicking play when a file is loaded calls audioEngine.play", async () => {
    usePlaybackStore.setState({
      ...usePlaybackStore.getState(),
      currentFile: file,
      isPlaying: false,
    });
    render(<PlaybackBar />);
    await userEvent.click(screen.getByTestId("transport-play-pause"));
    expect(mockPlay).toHaveBeenCalledWith(file);
  });

  test("clicking play with no currentFile plays the selected file from browserStore", async () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      fileList: [file],
      selectedIndex: 0,
    });
    render(<PlaybackBar />);
    await userEvent.click(screen.getByTestId("transport-play-pause"));
    expect(mockPlay).toHaveBeenCalledWith(file);
  });

  test("clicking pause when playing calls audioEngine.pause", async () => {
    usePlaybackStore.setState({
      ...usePlaybackStore.getState(),
      currentFile: file,
      isPlaying: true,
    });
    render(<PlaybackBar />);
    await userEvent.click(screen.getByTestId("transport-play-pause"));
    expect(mockPause).toHaveBeenCalledOnce();
  });

  test("clicking stop calls audioEngine.stop", async () => {
    usePlaybackStore.setState({
      ...usePlaybackStore.getState(),
      currentFile: file,
      isPlaying: true,
    });
    render(<PlaybackBar />);
    await userEvent.click(screen.getByTestId("transport-stop"));
    expect(mockStop).toHaveBeenCalledOnce();
  });
});

describe("PlaybackBar — loop button", () => {
  test("renders loop button", () => {
    render(<PlaybackBar />);
    expect(screen.getByTestId("loop-btn")).toBeDefined();
  });

  test("clicking loop button calls toggleLoop in playbackStore", async () => {
    const toggleLoop = vi.fn();
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), toggleLoop });
    render(<PlaybackBar />);
    await userEvent.click(screen.getByTestId("loop-btn"));
    expect(toggleLoop).toHaveBeenCalledOnce();
  });

  test("loop button has aria-pressed=true when loop is active", () => {
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), loop: true });
    render(<PlaybackBar />);
    expect(screen.getByTestId("loop-btn").getAttribute("aria-pressed")).toBe("true");
  });

  test("loop button has aria-pressed=false when loop is inactive", () => {
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), loop: false });
    render(<PlaybackBar />);
    expect(screen.getByTestId("loop-btn").getAttribute("aria-pressed")).toBe("false");
  });
});

describe("PlaybackBar — volume", () => {
  test("renders volume slider", () => {
    render(<PlaybackBar />);
    expect(screen.getByTestId("volume-slider")).toBeDefined();
  });

  test("volume slider reflects store volume", () => {
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), volume: 0.5 });
    render(<PlaybackBar />);
    const slider = screen.getByTestId("volume-slider") as HTMLInputElement;
    expect(Number(slider.value)).toBeCloseTo(0.5);
  });

  test("changing volume slider calls setVolume", () => {
    const setVolume = vi.fn();
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), setVolume });
    render(<PlaybackBar />);
    const slider = screen.getByTestId("volume-slider");
    fireEvent.change(slider, { target: { value: "0.3" } });
    expect(setVolume).toHaveBeenCalledWith(0.3);
  });

  test("changing volume slider calls audioEngine.setVolume", () => {
    render(<PlaybackBar />);
    const slider = screen.getByTestId("volume-slider");
    fireEvent.change(slider, { target: { value: "0.6" } });
    expect(mockSetVolume).toHaveBeenCalledWith(0.6);
  });
});

describe("PlaybackBar — current file", () => {
  test("shows current file name when a file is loaded", () => {
    usePlaybackStore.setState({
      ...usePlaybackStore.getState(),
      currentFile: file,
    });
    render(<PlaybackBar />);
    expect(screen.getByTestId("current-file-name")).toBeDefined();
    expect(screen.getByTestId("current-file-name").textContent).toBe("kick.wav");
  });

  test("shows nothing for file name when no file is loaded", () => {
    render(<PlaybackBar />);
    expect(screen.queryByTestId("current-file-name")).toBeNull();
  });
});

describe("PlaybackBar — timeline scrubber", () => {
  test("renders the timeline scrubber", () => {
    render(<PlaybackBar />);
    expect(screen.getByTestId("timeline-scrubber")).toBeDefined();
  });

  test("scrubber max equals store duration", () => {
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), duration: 120 });
    render(<PlaybackBar />);
    const scrubber = screen.getByTestId("timeline-scrubber") as HTMLInputElement;
    expect(Number(scrubber.max)).toBe(120);
  });

  test("scrubber starts at 0 when no playback", () => {
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), duration: 60 });
    render(<PlaybackBar />);
    const scrubber = screen.getByTestId("timeline-scrubber") as HTMLInputElement;
    expect(Number(scrubber.value)).toBe(0);
  });
  test("releasing scrubber calls audioEngine.seek with the dragged position", () => {
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), duration: 60 });
    render(<PlaybackBar />);
    const scrubber = screen.getByTestId("timeline-scrubber");
    fireEvent.pointerDown(scrubber);
    fireEvent.change(scrubber, { target: { value: "30" } });
    fireEvent.pointerUp(scrubber, { target: { value: "30" } });
    expect(mockSeek).toHaveBeenCalledWith(30);
  });

  test("dragging scrubber does not call audioEngine.seek until release", () => {
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), duration: 60 });
    render(<PlaybackBar />);
    const scrubber = screen.getByTestId("timeline-scrubber");
    fireEvent.pointerDown(scrubber);
    fireEvent.change(scrubber, { target: { value: "15" } });
    fireEvent.change(scrubber, { target: { value: "30" } });
    expect(mockSeek).not.toHaveBeenCalled();
  });
});

describe("PlaybackBar — timestamps", () => {
  test("shows formatted current position (0:00:00 when idle)", () => {
    render(<PlaybackBar />);
    expect(screen.getByTestId("timestamp-current").textContent).toBe("0:00:00");
  });

  test("shows formatted duration", () => {
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), duration: 3661 });
    render(<PlaybackBar />);
    expect(screen.getByTestId("timestamp-duration").textContent).toBe("1:01:01");
  });
});

describe("PlaybackBar — cursor sync (RAF)", () => {
  let rafCallback: FrameRequestCallback | null = null;
  const mockRaf = vi.fn().mockImplementation((cb: FrameRequestCallback) => {
    rafCallback = cb;
    return 42;
  });
  const mockCaf = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", mockRaf);
    vi.stubGlobal("cancelAnimationFrame", mockCaf);
    rafCallback = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("starts RAF loop when isPlaying becomes true", () => {
    render(<PlaybackBar />);
    act(() => usePlaybackStore.setState({ ...usePlaybackStore.getState(), isPlaying: true }));
    expect(mockRaf).toHaveBeenCalled();
  });

  test("scrubber value reflects audioEngine.getPosition on each RAF tick", () => {
    mockGetPosition.mockReturnValue(5);
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), duration: 10 });
    render(<PlaybackBar />);
    act(() => usePlaybackStore.setState({ ...usePlaybackStore.getState(), isPlaying: true }));
    act(() => {
      rafCallback?.(16);
    });
    const scrubber = screen.getByTestId("timeline-scrubber") as HTMLInputElement;
    expect(Number(scrubber.value)).toBe(5);
  });

  test("cancels RAF loop when playback stops", () => {
    render(<PlaybackBar />);
    act(() => usePlaybackStore.setState({ ...usePlaybackStore.getState(), isPlaying: true }));
    act(() => usePlaybackStore.setState({ ...usePlaybackStore.getState(), isPlaying: false }));
    expect(mockCaf).toHaveBeenCalledWith(42);
  });
});
