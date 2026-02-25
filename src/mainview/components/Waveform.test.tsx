import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";

// ── Hoisted mock handles (must precede vi.mock hoisting) ─────────────────────

const { mockLoad, mockDestroy, mockGetDuration, mockOn, mockCreate, mockSeek, mockGetBlobUrl } =
  vi.hoisted(() => ({
    mockLoad: vi.fn().mockResolvedValue(undefined),
    mockDestroy: vi.fn(),
    mockGetDuration: vi.fn().mockReturnValue(10),
    mockOn: vi.fn(),
    mockCreate: vi.fn(),
    mockSeek: vi.fn(),
    mockGetBlobUrl: vi.fn().mockReturnValue("blob:mock://test"),
  }));

// ── WaveSurfer mock ───────────────────────────────────────────────────────────

vi.mock("wavesurfer.js", () => ({
  default: { create: mockCreate },
}));

// ── audioEngine mock ──────────────────────────────────────────────────────────

vi.mock("../services/audioEngine", () => ({
  audioEngine: { seek: mockSeek, getBlobUrl: mockGetBlobUrl },
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

  test("loads the current file via blob URL when currentFile is set", async () => {
    usePlaybackStore.setState({
      ...usePlaybackStore.getState(),
      currentFile: file,
    });
    render(<Waveform />);
    await act(async () => {});
    expect(mockGetBlobUrl).toHaveBeenCalledWith(file.path);
    expect(mockLoad).toHaveBeenCalledWith("blob:mock://test");
  });

  test("re-loads via blob URL when currentFile changes", async () => {
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
    expect(mockLoad).toHaveBeenLastCalledWith("blob:mock://test");
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

  test("seeking event calls audioEngine.seek with current time", async () => {
    render(<Waveform />);
    // Capture the seeking callback registered via ws.on("seeking", cb)
    const seekHandler = mockOn.mock.calls.find(([event]) => event === "seeking")?.[1] as
      | ((currentTime: number) => void)
      | undefined;
    expect(seekHandler).toBeDefined();
    act(() => seekHandler?.(5));
    expect(mockSeek).toHaveBeenCalledWith(5);
  });
});
