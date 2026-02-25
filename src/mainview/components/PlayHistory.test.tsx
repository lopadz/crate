import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";
import { useBrowserStore } from "../stores/browserStore";

const { mockDbGetPlayHistory } = vi.hoisted(() => ({
  mockDbGetPlayHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock("../rpc", () => ({
  rpcClient: {
    request: {
      dbGetPlayHistory: mockDbGetPlayHistory,
    },
    send: {},
  },
}));

import { PlayHistory } from "./PlayHistory";

const file1: AudioFile = {
  path: "/Samples/kick.wav",
  name: "kick.wav",
  extension: ".wav",
  size: 1000,
  compositeId: "cid-1",
};
const file2: AudioFile = {
  path: "/Samples/snare.wav",
  name: "snare.wav",
  extension: ".wav",
  size: 2000,
  compositeId: "cid-2",
};

beforeEach(() => {
  vi.clearAllMocks();
  useBrowserStore.setState({
    ...useBrowserStore.getState(),
    fileList: [],
    selectedIndex: -1,
  });
});

describe("PlayHistory", () => {
  test("renders without crashing", () => {
    render(<PlayHistory />);
  });

  test("has play-history test id", () => {
    render(<PlayHistory />);
    expect(screen.getByTestId("play-history")).toBeDefined();
  });

  test("loads history via dbGetPlayHistory on mount", async () => {
    render(<PlayHistory />);
    await waitFor(() => expect(mockDbGetPlayHistory).toHaveBeenCalledWith({ limit: 10 }));
  });

  test("renders file names from history", async () => {
    mockDbGetPlayHistory.mockResolvedValue([file1, file2]);
    render(<PlayHistory />);
    await waitFor(() => expect(screen.getByText("kick.wav")).toBeDefined());
    expect(screen.getByText("snare.wav")).toBeDefined();
  });

  test("clicking a file loads it into browserStore", async () => {
    mockDbGetPlayHistory.mockResolvedValue([file1, file2]);
    render(<PlayHistory />);
    await waitFor(() => expect(screen.getByText("kick.wav")).toBeDefined());
    fireEvent.click(screen.getByText("kick.wav"));
    const { fileList, selectedIndex } = useBrowserStore.getState();
    expect(fileList).toEqual([file1, file2]);
    expect(selectedIndex).toBe(0);
  });

  test("shows empty state when no history", async () => {
    mockDbGetPlayHistory.mockResolvedValue([]);
    render(<PlayHistory />);
    await waitFor(() => expect(mockDbGetPlayHistory).toHaveBeenCalled());
    expect(screen.getByTestId("play-history-empty")).toBeDefined();
  });
});
