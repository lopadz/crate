import { beforeEach, describe, expect, test } from "vitest";
import type { AudioFile } from "../../shared/types";
import { usePlaybackStore } from "./playbackStore";

const file: AudioFile = { path: "/a/kick.wav", name: "kick.wav", extension: ".wav", size: 1000 };

beforeEach(() => {
  usePlaybackStore.setState({
    currentFile: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    loop: false,
    volume: 1,
  });
});

describe("playbackStore — file", () => {
  test("setCurrentFile updates currentFile", () => {
    usePlaybackStore.getState().setCurrentFile(file);
    expect(usePlaybackStore.getState().currentFile).toEqual(file);
  });

  test("setCurrentFile(null) clears current file and resets position", () => {
    usePlaybackStore.getState().setCurrentFile(file);
    usePlaybackStore.getState().setPosition(1.5);
    usePlaybackStore.getState().setCurrentFile(null);
    const s = usePlaybackStore.getState();
    expect(s.currentFile).toBeNull();
    expect(s.position).toBe(0);
  });
});

describe("playbackStore — playback state", () => {
  test("setIsPlaying toggles playing state", () => {
    usePlaybackStore.getState().setIsPlaying(true);
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
    usePlaybackStore.getState().setIsPlaying(false);
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
  });

  test("setPosition updates position", () => {
    usePlaybackStore.getState().setPosition(3.14);
    expect(usePlaybackStore.getState().position).toBe(3.14);
  });

  test("setDuration updates duration", () => {
    usePlaybackStore.getState().setDuration(60);
    expect(usePlaybackStore.getState().duration).toBe(60);
  });
});

describe("playbackStore — loop & volume", () => {
  test("toggleLoop flips loop state", () => {
    expect(usePlaybackStore.getState().loop).toBe(false);
    usePlaybackStore.getState().toggleLoop();
    expect(usePlaybackStore.getState().loop).toBe(true);
    usePlaybackStore.getState().toggleLoop();
    expect(usePlaybackStore.getState().loop).toBe(false);
  });

  test("setVolume clamps to [0, 1]", () => {
    usePlaybackStore.getState().setVolume(0.5);
    expect(usePlaybackStore.getState().volume).toBe(0.5);
    usePlaybackStore.getState().setVolume(2);
    expect(usePlaybackStore.getState().volume).toBe(1);
    usePlaybackStore.getState().setVolume(-1);
    expect(usePlaybackStore.getState().volume).toBe(0);
  });
});
