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

const mockGainConnect = vi.fn();
const mockGainNode = { connect: mockGainConnect, gain: { value: 1.0 } };
const mockCreateGain = vi.fn().mockReturnValue(mockGainNode);

const mockCreateBufferSource = vi.fn().mockImplementation(makeSourceNode);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockCreateBuffer = vi.fn().mockReturnValue(mockAudioBuffer);

class MockAudioContext {
  createBufferSource = mockCreateBufferSource;
  createBuffer = mockCreateBuffer;
  createGain = mockCreateGain;
  destination = {};
  currentTime = 0;
  state = "running";
  close = mockClose;
}
vi.stubGlobal("AudioContext", MockAudioContext);

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { AudioEngine } from "./audioEngine";
import { usePlaybackStore } from "../stores/playbackStore";
import { useSettingsStore } from "../stores/settingsStore";
import { Input } from "mediabunny";

// ── Helpers ───────────────────────────────────────────────────────────────────

const file: AudioFile = { path: "/S/kick.wav", name: "kick.wav", extension: ".wav", size: 1000 };
const prev: AudioFile = { path: "/S/prev.wav", name: "prev.wav", extension: ".wav", size: 500 };
const next: AudioFile = { path: "/S/next.wav", name: "next.wav", extension: ".wav", size: 500 };

const resetStores = () => {
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AudioEngine", () => {
  let engine: AudioEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
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

describe("AudioEngine — volume normalization", () => {
  let engine: AudioEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
    engine = new AudioEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  test("play() creates a GainNode when normalizeVolume is true", async () => {
    useSettingsStore.setState({ ...useSettingsStore.getState(), normalizeVolume: true });
    await engine.play(file);
    expect(mockCreateGain).toHaveBeenCalledOnce();
  });

  test("play() does not create a GainNode when normalizeVolume is false", async () => {
    await engine.play(file);
    expect(mockCreateGain).not.toHaveBeenCalled();
  });

  test("source connects through GainNode to destination when normalizing", async () => {
    useSettingsStore.setState({ ...useSettingsStore.getState(), normalizeVolume: true });
    await engine.play(file);
    // source.connect called with gainNode, gainNode.connect called with destination
    expect(mockConnect).toHaveBeenCalledWith(mockGainNode);
    expect(mockGainConnect).toHaveBeenCalledWith(expect.any(Object));
  });

  test("source connects directly to destination when not normalizing", async () => {
    await engine.play(file);
    // source.connect called directly with ctx.destination (not gainNode)
    expect(mockConnect).not.toHaveBeenCalledWith(mockGainNode);
  });
});
