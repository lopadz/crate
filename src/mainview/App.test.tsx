import { vi, describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./rpc", () => ({
  rpcClient: {
    request: { fsReaddir: vi.fn().mockResolvedValue([]), dbGetPinnedFolders: vi.fn().mockResolvedValue([]), fsListDirs: vi.fn().mockResolvedValue([]) },
    send: { fsStartWatch: vi.fn(), fsStopWatch: vi.fn() },
  },
}));
vi.mock("wavesurfer.js", () => ({
  default: { create: vi.fn().mockReturnValue({ on: vi.fn(), load: vi.fn(), destroy: vi.fn(), getDuration: vi.fn() }) },
}));
vi.mock("./services/audioEngine", () => ({ audioEngine: { seek: vi.fn() } }));

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
