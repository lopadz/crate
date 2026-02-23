import { vi, describe, test, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockFsListDirs, mockFsReaddir } = vi.hoisted(() => ({
  mockFsListDirs: vi.fn(),
  mockFsReaddir: vi.fn(),
}));

vi.mock("../rpc", () => ({
  rpcClient: {
    request: { fsListDirs: mockFsListDirs, fsReaddir: mockFsReaddir },
  },
}));

import { FolderPicker } from "./FolderPicker";

beforeEach(() => {
  vi.clearAllMocks();
  mockFsListDirs.mockResolvedValue(["/start/Drums", "/start/Bass", "/start/FX"]);
  mockFsReaddir.mockResolvedValue([]);
});

describe("FolderPicker", () => {
  test("renders with folder-picker testid", async () => {
    render(<FolderPicker initialPath="/start" onPin={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId("folder-picker")).toBeDefined();
  });

  test("shows the initial path", async () => {
    render(<FolderPicker initialPath="/start" onPin={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId("folder-picker-path").textContent).toContain("start");
  });

  test("lists subdirectories of the initial path", async () => {
    render(<FolderPicker initialPath="/start" onPin={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Drums")).toBeDefined());
    expect(screen.getByText("Bass")).toBeDefined();
    expect(screen.getByText("FX")).toBeDefined();
  });

  test("clicking a directory navigates into it", async () => {
    mockFsListDirs
      .mockResolvedValueOnce(["/start/Drums"])
      .mockResolvedValueOnce(["/start/Drums/Kicks", "/start/Drums/Snares"]);

    render(<FolderPicker initialPath="/start" onPin={() => {}} onClose={() => {}} />);
    await waitFor(() => screen.getByText("Drums"));
    await userEvent.click(screen.getByText("Drums"));

    expect(mockFsListDirs).toHaveBeenLastCalledWith({ path: "/start/Drums" });
    await waitFor(() => expect(screen.getByText("Kicks")).toBeDefined());
  });

  test("up button navigates to parent directory", async () => {
    render(<FolderPicker initialPath="/start/Drums" onPin={() => {}} onClose={() => {}} />);
    await userEvent.click(screen.getByTestId("folder-picker-up"));
    expect(mockFsListDirs).toHaveBeenLastCalledWith({ path: "/start" });
  });

  test("up button is disabled at the filesystem root", () => {
    render(<FolderPicker initialPath="/" onPin={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId("folder-picker-up")).toBeDisabled();
  });

  test("Pin button calls onPin with the current path", async () => {
    const onPin = vi.fn();
    render(<FolderPicker initialPath="/start" onPin={onPin} onClose={() => {}} />);
    await userEvent.click(screen.getByTestId("folder-picker-pin"));
    expect(onPin).toHaveBeenCalledWith("/start");
  });

  test("Pin button shows the current folder name", async () => {
    render(<FolderPicker initialPath="/start/Drums" onPin={() => {}} onClose={() => {}} />);
    expect(screen.getByTestId("folder-picker-pin").textContent).toContain("Drums");
  });

  test("Cancel button calls onClose", async () => {
    const onClose = vi.fn();
    render(<FolderPicker initialPath="/start" onPin={() => {}} onClose={onClose} />);
    await userEvent.click(screen.getByTestId("folder-picker-cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("lists audio files in the current directory", async () => {
    mockFsReaddir.mockResolvedValue([
      { path: "/start/kick.wav", name: "kick.wav", extension: ".wav", size: 1000 },
      { path: "/start/snare.wav", name: "snare.wav", extension: ".wav", size: 2000 },
    ]);
    render(<FolderPicker initialPath="/start" onPin={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("kick.wav")).toBeDefined());
    expect(screen.getByText("snare.wav")).toBeDefined();
  });

  test("directories and files have distinct testids", async () => {
    mockFsListDirs.mockResolvedValue(["/start/Drums"]);
    mockFsReaddir.mockResolvedValue([
      { path: "/start/kick.wav", name: "kick.wav", extension: ".wav", size: 1000 },
    ]);
    render(<FolderPicker initialPath="/start" onPin={() => {}} onClose={() => {}} />);
    await waitFor(() => screen.getByText("Drums"));
    await waitFor(() => screen.getByText("kick.wav"));
    expect(screen.getAllByTestId("folder-picker-dir")).toHaveLength(1);
    expect(screen.getAllByTestId("folder-picker-file")).toHaveLength(1);
  });
});
