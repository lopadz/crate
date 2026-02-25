import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockTransportStart,
  mockTransportStop,
  mockTransportCancel,
  mockPartStart,
  mockPartStop,
  mockPartDispose,
  mockPartConstructor,
  mockToneStart,
  mockToDestination,
} = vi.hoisted(() => ({
  mockTransportStart: vi.fn(),
  mockTransportStop: vi.fn(),
  mockTransportCancel: vi.fn(),
  mockPartStart: vi.fn(),
  mockPartStop: vi.fn(),
  mockPartDispose: vi.fn(),
  mockPartConstructor: vi.fn(),
  mockToneStart: vi.fn().mockResolvedValue(undefined),
  mockToDestination: vi.fn().mockReturnValue({}),
}));

// ── tone mock ─────────────────────────────────────────────────────────────────

vi.mock("tone", () => ({
  start: mockToneStart,
  Transport: {
    start: mockTransportStart,
    stop: mockTransportStop,
    cancel: mockTransportCancel,
    position: 0,
  },
  // biome-ignore lint/complexity/useArrowFunction: function() required for vi.fn() constructor mock in Vitest 4.x
  Part: vi.fn().mockImplementation(function (cb: unknown, events: unknown) {
    mockPartConstructor(cb, events);
    return { start: mockPartStart, stop: mockPartStop, dispose: mockPartDispose };
  }),
  // biome-ignore lint/complexity/useArrowFunction: function() required for vi.fn() constructor mock in Vitest 4.x
  PolySynth: vi.fn().mockImplementation(function () {
    return { toDestination: mockToDestination };
  }),
  Synth: vi.fn(),
}));

// ── @tonejs/midi mock ─────────────────────────────────────────────────────────

const mockNotes = [
  { name: "C4", time: 0, duration: 0.5, velocity: 0.8 },
  { name: "E4", time: 0.5, duration: 0.5, velocity: 0.7 },
];

vi.mock("@tonejs/midi", () => ({
  // biome-ignore lint/complexity/useArrowFunction: function() required for vi.fn() constructor mock in Vitest 4.x
  Midi: vi.fn().mockImplementation(function () {
    return {
      tracks: [
        { notes: mockNotes },
        { notes: [] }, // empty track — should be skipped
      ],
    };
  }),
}));

// ── fetch mock ────────────────────────────────────────────────────────────────

const mockArrayBuffer = new ArrayBuffer(100);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer) }),
  );
});

// ── Import after mocks ────────────────────────────────────────────────────────

import { midiEngine } from "./midiEngine";

// ── Helpers ───────────────────────────────────────────────────────────────────

const midiFile: AudioFile = {
  path: "/S/beat.mid",
  name: "beat.mid",
  extension: ".mid",
  size: 2000,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("midiEngine", () => {
  test("play() fetches the MIDI file by file:// URL", async () => {
    await midiEngine.play(midiFile);
    expect(fetch).toHaveBeenCalledWith(`file://${midiFile.path}`);
  });

  test("play() calls Tone.start() to unlock AudioContext", async () => {
    await midiEngine.play(midiFile);
    expect(mockToneStart).toHaveBeenCalledOnce();
  });

  test("play() calls Tone.Transport.start()", async () => {
    await midiEngine.play(midiFile);
    expect(mockTransportStart).toHaveBeenCalledOnce();
  });

  test("play() creates a Part for each non-empty track", async () => {
    await midiEngine.play(midiFile);
    // 2 tracks in mock, 1 has notes, 1 is empty → 1 Part created
    expect(mockPartConstructor).toHaveBeenCalledTimes(1);
    expect(mockPartStart).toHaveBeenCalledTimes(1);
  });

  test("play() skips tracks with no notes", async () => {
    await midiEngine.play(midiFile);
    // Only 1 of 2 tracks has notes
    expect(mockPartConstructor).toHaveBeenCalledTimes(1);
  });

  test("play() calls stop() before starting new playback", async () => {
    await midiEngine.play(midiFile);
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer) }),
    );
    await midiEngine.play(midiFile);
    // Transport.cancel + Transport.stop called as part of stop()
    expect(mockTransportStop).toHaveBeenCalled();
    expect(mockTransportCancel).toHaveBeenCalled();
  });

  test("stop() calls Tone.Transport.stop()", () => {
    midiEngine.stop();
    expect(mockTransportStop).toHaveBeenCalledOnce();
  });

  test("stop() calls Tone.Transport.cancel()", () => {
    midiEngine.stop();
    expect(mockTransportCancel).toHaveBeenCalledOnce();
  });

  test("stop() disposes all Parts", async () => {
    await midiEngine.play(midiFile);
    vi.clearAllMocks();
    midiEngine.stop();
    expect(mockPartStop).toHaveBeenCalled();
    expect(mockPartDispose).toHaveBeenCalled();
  });
});
