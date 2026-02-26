import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("./rpc", () => ({
  rpcClient: {
    request: {
      dbGetAllTags: vi.fn().mockResolvedValue([]),
      dbGetFileTags: vi.fn().mockResolvedValue([]),
      dbGetPinnedFolders: vi.fn().mockResolvedValue([]),
      fsReaddir: vi.fn().mockResolvedValue([]),
      fsListDirs: vi.fn().mockResolvedValue([]),
      collectionGetAll: vi.fn().mockResolvedValue([]),
      dawCreateDragCopy: vi.fn().mockResolvedValue("/tmp/drag/test.wav"),
      dbSearchFiles: vi.fn().mockResolvedValue([]),
      dbGetNote: vi.fn().mockResolvedValue(null),
      dbGetPlayHistory: vi.fn().mockResolvedValue([]),
    },
    send: { fsStartWatch: vi.fn(), fsStopWatch: vi.fn() },
  },
}));
vi.mock("wavesurfer.js", () => ({
  default: {
    create: vi.fn().mockReturnValue({
      on: vi.fn(),
      load: vi.fn(),
      destroy: vi.fn(),
      getDuration: vi.fn(),
    }),
  },
}));
vi.mock("./services/audioEngine", () => ({
  audioEngine: {
    seek: vi.fn(),
    preload: vi.fn(),
    getBlobUrl: vi.fn().mockReturnValue(undefined),
    getPosition: vi.fn().mockReturnValue(0),
  },
}));

import App from "./App";

describe("App", () => {
  test("renders without crashing", () => {
    render(<App />);
  });

  test("renders sidebar, file list panel, detail panel, and playback bar", () => {
    render(<App />);
    expect(screen.getByTestId("sidebar")).toBeDefined();
    expect(screen.getByTestId("file-list-panel")).toBeDefined();
    expect(screen.getByTestId("detail-panel")).toBeDefined();
    expect(screen.getByTestId("playback-bar")).toBeDefined();
  });
});
