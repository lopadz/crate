import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";

// ── Hoisted mock handles (must precede vi.mock hoisting) ─────────────────────

const {
  mockLoad,
  mockDestroy,
  mockGetDuration,
  mockOn,
  mockCreate,
  mockSeek,
  mockGetPosition,
  mockSeekTo,
  mockGetAudioUrl,
  mockGetCachedBuffer,
} = vi.hoisted(() => ({
  mockLoad: vi.fn().mockResolvedValue(undefined),
  mockDestroy: vi.fn(),
  mockGetDuration: vi.fn().mockReturnValue(10),
  mockOn: vi.fn(),
  mockCreate: vi.fn(),
  mockSeek: vi.fn(),
  mockGetPosition: vi.fn().mockReturnValue(0),
  mockSeekTo: vi.fn(),
  mockGetAudioUrl: vi.fn().mockReturnValue("http://audio.mock/test"),
  mockGetCachedBuffer: vi.fn().mockReturnValue(undefined),
}));

// ── WaveSurfer mock ───────────────────────────────────────────────────────────

vi.mock("wavesurfer.js", () => ({
  default: { create: mockCreate },
}));

// ── audioEngine mock ──────────────────────────────────────────────────────────

vi.mock("../services/audioEngine", () => ({
  audioEngine: {
    seek: mockSeek,
    getPosition: mockGetPosition,
    getAudioUrl: mockGetAudioUrl,
    getCachedBuffer: mockGetCachedBuffer,
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { usePlaybackStore } from "../stores/playbackStore";
import { Waveform } from "./Waveform";

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeWsInstance = () => {
  const inst = {
    on: mockOn,
    load: mockLoad,
    destroy: mockDestroy,
    getDuration: mockGetDuration,
    seekTo: mockSeekTo,
  };
  mockCreate.mockReturnValue(inst);
  return inst;
};

const file: AudioFile = {
  path: "/S/kick.wav",
  name: "kick.wav",
  extension: ".wav",
  size: 1000,
};
const file2: AudioFile = {
  path: "/S/snare.mp3",
  name: "snare.mp3",
  extension: ".mp3",
  size: 2000,
};

const resetStore = () =>
  usePlaybackStore.setState({
    currentFile: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    loop: false,
    volume: 1,
  });

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  makeWsInstance();
});

describe("Waveform", () => {
  test("renders the waveform container", () => {
    render(<Waveform />);
    expect(screen.getByTestId("waveform")).toBeDefined();
  });

  test("creates a WaveSurfer instance on mount", () => {
    render(<Waveform />);
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  test("loads the current file when currentFile is set", async () => {
    usePlaybackStore.setState({
      ...usePlaybackStore.getState(),
      currentFile: file,
    });
    render(<Waveform />);
    await act(async () => {});
    expect(mockGetAudioUrl).toHaveBeenCalledWith(file.path);
    expect(mockLoad).toHaveBeenCalledWith("http://audio.mock/test", undefined, undefined);
  });

  test("passes decoded peaks and duration from cached buffer when available", async () => {
    const ch0 = new Float32Array([0.1, -0.1]);
    const ch1 = new Float32Array([0.2, -0.2]);
    const mockBuffer = {
      numberOfChannels: 2,
      getChannelData: (ch: number) => (ch === 0 ? ch0 : ch1),
      duration: 42,
    };
    mockGetCachedBuffer.mockReturnValue(mockBuffer);
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), currentFile: file });
    render(<Waveform />);
    await act(async () => {});
    expect(mockLoad).toHaveBeenCalledWith("http://audio.mock/test", [ch0, ch1], 42);
  });

  test("re-loads when currentFile changes", async () => {
    render(<Waveform />);
    act(() =>
      usePlaybackStore.setState({
        ...usePlaybackStore.getState(),
        currentFile: file,
      }),
    );
    await act(async () => {});
    act(() =>
      usePlaybackStore.setState({
        ...usePlaybackStore.getState(),
        currentFile: file2,
      }),
    );
    await act(async () => {});
    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(mockLoad).toHaveBeenLastCalledWith("http://audio.mock/test", undefined, undefined);
  });

  test("does not call load when currentFile is null", async () => {
    render(<Waveform />);
    await act(async () => {});
    expect(mockLoad).not.toHaveBeenCalled();
  });

  test("destroys WaveSurfer on unmount", () => {
    const { unmount } = render(<Waveform />);
    unmount();
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  test("resets cursor to start when a new file is loaded", async () => {
    render(<Waveform />);
    act(() => usePlaybackStore.setState({ ...usePlaybackStore.getState(), currentFile: file }));
    await act(async () => {});
    act(() => usePlaybackStore.setState({ ...usePlaybackStore.getState(), currentFile: file2 }));
    await act(async () => {});
    expect(mockSeekTo).toHaveBeenLastCalledWith(0);
  });

  test("does not start RAF loop when not playing", () => {
    const mockRaf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", mockRaf);
    render(<Waveform />);
    expect(mockRaf).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  test("interaction event calls audioEngine.seek with current time", async () => {
    render(<Waveform />);
    // Capture the interaction callback registered via ws.on("interaction", cb)
    const interactionHandler = mockOn.mock.calls.find(([event]) => event === "interaction")?.[1] as
      | ((currentTime: number) => void)
      | undefined;
    expect(interactionHandler).toBeDefined();
    act(() => interactionHandler?.(5));
    expect(mockSeek).toHaveBeenCalledWith(5);
  });
});

describe("Waveform — cursor sync", () => {
  let rafCallback: FrameRequestCallback | null = null;
  const mockRaf = vi.fn().mockImplementation((cb: FrameRequestCallback) => {
    rafCallback = cb;
    return 1;
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

  test("seeks WaveSurfer to the fractional audio position on each RAF tick", () => {
    mockGetPosition.mockReturnValue(3); // 3s into a 10s file → seekTo(0.3)
    render(<Waveform />);
    act(() => usePlaybackStore.setState({ ...usePlaybackStore.getState(), isPlaying: true }));
    act(() => {
      rafCallback?.(16);
    });
    expect(mockSeekTo).toHaveBeenCalledWith(0.3);
  });

  test("wraps position past duration on loop (seekTo reflects looped position)", () => {
    mockGetPosition.mockReturnValue(12); // 12s elapsed, duration=10 → 12%10=2 → seekTo(0.2)
    render(<Waveform />);
    act(() => usePlaybackStore.setState({ ...usePlaybackStore.getState(), isPlaying: true }));
    act(() => {
      rafCallback?.(16);
    });
    expect(mockSeekTo).toHaveBeenCalledWith(0.2);
  });

  test("cancels the RAF loop when playback stops", () => {
    render(<Waveform />);
    act(() => usePlaybackStore.setState({ ...usePlaybackStore.getState(), isPlaying: true }));
    act(() => usePlaybackStore.setState({ ...usePlaybackStore.getState(), isPlaying: false }));
    expect(mockCaf).toHaveBeenCalledWith(1);
  });
});
