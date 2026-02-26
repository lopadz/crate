import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";

// ── RPC mock ──────────────────────────────────────────────────────────────────

const { mockFsReadAudio } = vi.hoisted(() => ({
  mockFsReadAudio: vi.fn().mockResolvedValue("dGVzdA=="), // base64 "test"
}));

vi.mock("../rpc", () => ({
  rpcClient: {
    request: { fsReadAudio: mockFsReadAudio },
  },
}));

// ── Web Audio mock ────────────────────────────────────────────────────────────

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

const makeSourceNode = () => ({
  buffer: null as AudioBuffer | null,
  loop: false,
  connect: mockConnect,
  start: mockStart,
  stop: mockStop,
  disconnect: mockDisconnect,
  onended: null as (() => void) | null,
});

const mockGainConnect = vi.fn();
const mockGainNode = { connect: mockGainConnect, gain: { value: 1.0 } };
const mockCreateGain = vi.fn().mockReturnValue(mockGainNode);

const mockAudioBuffer = {
  length: 44100,
  numberOfChannels: 2,
  sampleRate: 44100,
  duration: 1.0,
  getChannelData: () => new Float32Array(44100),
} as unknown as AudioBuffer;

const mockDecodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer);
const mockCreateBufferSource = vi.fn().mockImplementation(makeSourceNode);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockCreateBuffer = vi.fn().mockReturnValue(mockAudioBuffer);

class MockAudioContext {
  createBufferSource = mockCreateBufferSource;
  createBuffer = mockCreateBuffer;
  createGain = mockCreateGain;
  decodeAudioData = mockDecodeAudioData;
  destination = {};
  currentTime = 0;
  state = "running";
  close = mockClose;
}
vi.stubGlobal("AudioContext", MockAudioContext);

// ── URL mock (jsdom doesn't implement createObjectURL) ────────────────────────
const mockCreateObjectURL = vi.fn().mockReturnValue("blob:mock://test");
const mockRevokeObjectURL = vi.fn();
URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { usePlaybackStore } from "../stores/playbackStore";
import { useSettingsStore } from "../stores/settingsStore";
import { AudioEngine } from "./audioEngine";

// ── Helpers ───────────────────────────────────────────────────────────────────

const file: AudioFile = {
  path: "/S/kick.wav",
  name: "kick.wav",
  extension: ".wav",
  size: 1000,
};
const prev: AudioFile = {
  path: "/S/prev.wav",
  name: "prev.wav",
  extension: ".wav",
  size: 500,
};
const next: AudioFile = {
  path: "/S/next.wav",
  name: "next.wav",
  extension: ".wav",
  size: 500,
};

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
    mockFsReadAudio.mockResolvedValue("dGVzdA==");
    mockDecodeAudioData.mockResolvedValue(mockAudioBuffer);
    resetStores();
    engine = new AudioEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  test("play() reads the file via fsReadAudio RPC", async () => {
    await engine.play(file);
    expect(mockFsReadAudio).toHaveBeenCalledWith({ path: file.path });
  });

  test("play() decodes the audio data via decodeAudioData", async () => {
    await engine.play(file);
    expect(mockDecodeAudioData).toHaveBeenCalledOnce();
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

  test("playing the same file twice uses the cached buffer (fsReadAudio called once)", async () => {
    await engine.play(file);
    await engine.play(file);
    expect(mockFsReadAudio).toHaveBeenCalledOnce();
  });

  test("play() with neighbors preloads them in the background", async () => {
    await engine.play(file, [prev, next]);
    // flush microtask queue so the background preloads run
    await new Promise((r) => setTimeout(r, 20));
    // fsReadAudio called: 1 for main + 2 for neighbors
    expect(mockFsReadAudio).toHaveBeenCalledTimes(3);
  });

  test("getAudioUrl() returns an http URL when server is configured", () => {
    engine.setServerConfig("http://localhost:9999", "tok123");
    expect(engine.getAudioUrl(file.path)).toBe(
      `http://localhost:9999/audio?path=${encodeURIComponent(file.path)}&token=tok123`,
    );
  });

  test("getAudioUrl() returns undefined when server is not configured", () => {
    expect(engine.getAudioUrl("/never/loaded.wav")).toBeUndefined();
  });

  test("getBlobUrl() delegates to getAudioUrl()", () => {
    engine.setServerConfig("http://localhost:9999", "tok123");
    expect(engine.getBlobUrl(file.path)).toBe(engine.getAudioUrl(file.path));
  });

  test("preload() warms the cache without playing", async () => {
    engine.preload(file);
    await new Promise((r) => setTimeout(r, 20));
    // Falls back to fsReadAudio since no server config in test env
    expect(mockFsReadAudio).toHaveBeenCalledWith({ path: file.path });
    // No source node was started
    expect(mockStart).not.toHaveBeenCalled();
  });

  test("dispose() does not throw", async () => {
    await engine.play(file);
    expect(() => engine.dispose()).not.toThrow();
  });
});

describe("AudioEngine — volume normalization", () => {
  let engine: AudioEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFsReadAudio.mockResolvedValue("dGVzdA==");
    mockDecodeAudioData.mockResolvedValue(mockAudioBuffer);
    resetStores();
    engine = new AudioEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  test("play() creates a GainNode when normalizeVolume is true", async () => {
    useSettingsStore.setState({
      ...useSettingsStore.getState(),
      normalizeVolume: true,
    });
    await engine.play(file);
    expect(mockCreateGain).toHaveBeenCalledOnce();
  });

  test("play() does not create a GainNode when normalizeVolume is false", async () => {
    await engine.play(file);
    expect(mockCreateGain).not.toHaveBeenCalled();
  });

  test("source connects through GainNode to destination when normalizing", async () => {
    useSettingsStore.setState({
      ...useSettingsStore.getState(),
      normalizeVolume: true,
    });
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

describe("AudioEngine — loop and pause", () => {
  let engine: AudioEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFsReadAudio.mockResolvedValue("dGVzdA==");
    mockDecodeAudioData.mockResolvedValue(mockAudioBuffer);
    resetStores();
    engine = new AudioEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  test("setLoop(true) sets loop=true on the active source node", async () => {
    await engine.play(file);
    const source = mockCreateBufferSource.mock.results[0].value as ReturnType<
      typeof makeSourceNode
    >;
    engine.setLoop(true);
    expect(source.loop).toBe(true);
  });

  test("setLoop(false) sets loop=false on the active source node", async () => {
    await engine.play(file);
    const source = mockCreateBufferSource.mock.results[0].value as ReturnType<
      typeof makeSourceNode
    >;
    engine.setLoop(true);
    engine.setLoop(false);
    expect(source.loop).toBe(false);
  });

  test("setLoop is a no-op when no source is active", () => {
    expect(() => engine.setLoop(true)).not.toThrow();
  });

  test("play() applies loop=true when playbackStore.loop is true", async () => {
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), loop: true });
    await engine.play(file);
    const source = mockCreateBufferSource.mock.results[0].value as ReturnType<
      typeof makeSourceNode
    >;
    expect(source.loop).toBe(true);
  });

  test("play() applies loop=false when playbackStore.loop is false", async () => {
    usePlaybackStore.setState({ ...usePlaybackStore.getState(), loop: false });
    await engine.play(file);
    const source = mockCreateBufferSource.mock.results[0].value as ReturnType<
      typeof makeSourceNode
    >;
    expect(source.loop).toBe(false);
  });

  test("pause() sets isPlaying to false", async () => {
    await engine.play(file);
    engine.pause();
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });

  test("pause() stops the source node", async () => {
    await engine.play(file);
    engine.pause();
    expect(mockStop).toHaveBeenCalledOnce();
  });

  test("pause() without active playback does not throw", () => {
    expect(() => engine.pause()).not.toThrow();
  });
});

describe("AudioEngine — seek", () => {
  let engine: AudioEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFsReadAudio.mockResolvedValue("dGVzdA==");
    mockDecodeAudioData.mockResolvedValue(mockAudioBuffer);
    resetStores();
    engine = new AudioEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  test("seek() while playing starts from the seeked position", async () => {
    await engine.play(file);
    engine.seek(3.5);
    await new Promise((r) => setTimeout(r, 0));
    // Second source.start() must use offset 3.5, not restart from 0
    expect(mockStart).toHaveBeenNthCalledWith(2, 0, 3.5);
  });

  test("seek() while paused updates offset without starting a new source", async () => {
    await engine.play(file);
    engine.pause();
    vi.clearAllMocks();
    engine.seek(2.0);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockStart).not.toHaveBeenCalled();
  });

  test("play() for a different file always starts from position 0", async () => {
    await engine.play(file);
    engine.pause();
    engine.seek(3.5); // scrub while paused — pauseOffset is now 3.5
    vi.clearAllMocks();
    await engine.play(next); // different file — must ignore the stale offset
    expect(mockStart).toHaveBeenCalledWith(0, 0);
  });
});
