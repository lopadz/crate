import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import type { AudioFile } from "../../shared/types";

// ── Mediabunny mock ───────────────────────────────────────────────────────────

vi.mock("mediabunny", () => {
  const buf = {
    length: 44100,
    numberOfChannels: 2,
    sampleRate: 44100,
    duration: 1.0,
    getChannelData: () => new Float32Array(44100),
  } as unknown as AudioBuffer;

  return {
    ALL_FORMATS: [],
    UrlSource: vi.fn().mockImplementation(function () {}),
    Input: vi.fn().mockImplementation(function () {
      return {
        getPrimaryAudioTrack: vi.fn().mockResolvedValue({}),
        dispose: vi.fn(),
      };
    }),
    AudioBufferSink: vi.fn().mockImplementation(function () {
      return {
        buffers: async function* () {
          yield { buffer: buf, timestamp: 0, duration: 1.0 };
        },
      };
    }),
  };
});

// Expose mockAudioBuffer from the mock for assertions
const mockAudioBuffer = {
  length: 44100,
  numberOfChannels: 2,
  sampleRate: 44100,
  duration: 1.0,
  getChannelData: () => new Float32Array(44100),
} as unknown as AudioBuffer;

// ── Web Audio mock ────────────────────────────────────────────────────────────

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

const makeSourceNode = () => ({
  buffer: null as AudioBuffer | null,
  connect: mockConnect,
  start: mockStart,
  stop: mockStop,
  disconnect: mockDisconnect,
  onended: null as (() => void) | null,
});

const mockCreateBufferSource = vi.fn().mockImplementation(makeSourceNode);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockCreateBuffer = vi.fn().mockReturnValue(mockAudioBuffer);

class MockAudioContext {
  createBufferSource = mockCreateBufferSource;
  createBuffer = mockCreateBuffer;
  destination = {};
  currentTime = 0;
  state = "running";
  close = mockClose;
}
vi.stubGlobal("AudioContext", MockAudioContext);

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { AudioEngine } from "./audioEngine";
import { usePlaybackStore } from "../stores/playbackStore";
import { Input } from "mediabunny";

// ── Helpers ───────────────────────────────────────────────────────────────────

const file: AudioFile = { path: "/S/kick.wav", name: "kick.wav", extension: ".wav", size: 1000 };
const prev: AudioFile = { path: "/S/prev.wav", name: "prev.wav", extension: ".wav", size: 500 };
const next: AudioFile = { path: "/S/next.wav", name: "next.wav", extension: ".wav", size: 500 };

const resetStore = () =>
  usePlaybackStore.setState({
    currentFile: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    loop: false,
    volume: 1,
  });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AudioEngine", () => {
  let engine: AudioEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    engine = new AudioEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  test("play() decodes the file via mediabunny Input", async () => {
    await engine.play(file);
    expect(Input).toHaveBeenCalledOnce();
  });

  test("play() starts an AudioBufferSourceNode", async () => {
    await engine.play(file);
    expect(mockCreateBufferSource).toHaveBeenCalledOnce();
    expect(mockStart).toHaveBeenCalledOnce();
  });

  test("play() sets currentFile in playbackStore", async () => {
    await engine.play(file);
    expect(usePlaybackStore.getState().currentFile).toEqual(file);
  });

  test("play() sets isPlaying to true in playbackStore", async () => {
    await engine.play(file);
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
  });

  test("stop() stops the source node", async () => {
    await engine.play(file);
    engine.stop();
    expect(mockStop).toHaveBeenCalledOnce();
  });

  test("stop() sets isPlaying to false in playbackStore", async () => {
    await engine.play(file);
    engine.stop();
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });

  test("play() while playing stops the previous source first", async () => {
    await engine.play(file);
    await engine.play(next);
    // stop called once for the first source before the second starts
    expect(mockStop).toHaveBeenCalledOnce();
    // Two sources were created (one per play)
    expect(mockCreateBufferSource).toHaveBeenCalledTimes(2);
  });

  test("playing the same file twice uses the cached buffer (Input called once)", async () => {
    await engine.play(file);
    await engine.play(file);
    expect(Input).toHaveBeenCalledOnce();
  });

  test("play() with neighbors preloads them in the background", async () => {
    await engine.play(file, [prev, next]);
    // flush microtask queue so the background preloads run
    await new Promise((r) => setTimeout(r, 20));
    // Input called: 1 for main + 2 for neighbors
    expect(Input).toHaveBeenCalledTimes(3);
  });
});
