import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockGetPosition } = vi.hoisted(() => ({
  mockGetPosition: vi.fn().mockReturnValue(0),
}));

vi.mock("../services/audioEngine", () => ({
  audioEngine: { getPosition: mockGetPosition },
}));

import { usePlaybackStore } from "../stores/playbackStore";
import { useAudioPosition } from "./useAudioPosition";

function setPlaying(value: boolean) {
  usePlaybackStore.setState({ ...usePlaybackStore.getState(), isPlaying: value });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPosition.mockReturnValue(0);
  usePlaybackStore.setState({
    currentFile: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    loop: false,
    volume: 1,
  });
});

describe("useAudioPosition — idle", () => {
  test("returns 0 when not playing", () => {
    const { result } = renderHook(() => useAudioPosition());
    expect(result.current).toBe(0);
  });

  test("snaps to audioEngine.getPosition() on mount when not playing", () => {
    mockGetPosition.mockReturnValue(3.5);
    const { result } = renderHook(() => useAudioPosition());
    expect(result.current).toBe(3.5);
  });
});

describe("useAudioPosition — RAF loop", () => {
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
    renderHook(() => useAudioPosition());
    act(() => setPlaying(true));
    expect(mockRaf).toHaveBeenCalled();
  });

  test("returns updated position on each RAF tick", () => {
    mockGetPosition.mockReturnValue(5);
    const { result } = renderHook(() => useAudioPosition());
    act(() => setPlaying(true));
    act(() => {
      rafCallback?.(16);
    });
    expect(result.current).toBe(5);
  });

  test("cancels RAF loop when isPlaying becomes false", () => {
    renderHook(() => useAudioPosition());
    act(() => setPlaying(true));
    act(() => setPlaying(false));
    expect(mockCaf).toHaveBeenCalledWith(42);
  });

  test("snaps to audioEngine.getPosition() when playback stops", () => {
    mockGetPosition.mockReturnValue(0);
    const { result } = renderHook(() => useAudioPosition());
    act(() => setPlaying(true));
    mockGetPosition.mockReturnValue(0); // stop() resets position to 0
    act(() => setPlaying(false));
    expect(result.current).toBe(0);
  });

  test("snaps to audioEngine.getPosition() when playback pauses", () => {
    const { result } = renderHook(() => useAudioPosition());
    act(() => setPlaying(true));
    mockGetPosition.mockReturnValue(7.2); // pause() preserves offset
    act(() => setPlaying(false));
    expect(result.current).toBe(7.2);
  });
});
