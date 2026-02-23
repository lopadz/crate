import { vi, describe, test, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../rpc", () => ({
  rpcClient: {
    request: { dbGetPinnedFolders: vi.fn(), fsListDirs: vi.fn(), fsOpenFolderDialog: vi.fn() },
    send: { dbPinFolder: vi.fn(), dbUnpinFolder: vi.fn() },
  },
}));

import { rpcClient } from "../rpc";
import { FolderTree } from "./FolderTree";
import { useBrowserStore } from "../stores/browserStore";

// vi.mock always provides a concrete object — safe to assert non-null
const rc = rpcClient as NonNullable<typeof rpcClient>;

beforeEach(() => {
  vi.clearAllMocks();
  useBrowserStore.setState({
    activeFolder: null,
    fileList: [],
    selectedIndex: -1,
    sortKey: "name",
    sortDir: "asc",
    filter: "",
  });
  (rc.request.dbGetPinnedFolders as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (rc.request.fsListDirs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (rc.request.fsOpenFolderDialog as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe("FolderTree", () => {
  test("renders without crashing", () => {
    render(<FolderTree />);
    expect(screen.getByTestId("folder-tree")).toBeDefined();
  });

  test("shows pinned folder names", async () => {
    (rc.request.dbGetPinnedFolders as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples",
    ]);
    render(<FolderTree />);
    await waitFor(() => expect(screen.getByText("Samples")).toBeDefined());
  });

  test("clicking a folder name sets activeFolder", async () => {
    (rc.request.dbGetPinnedFolders as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples",
    ]);
    render(<FolderTree />);
    await waitFor(() => screen.getByText("Samples"));
    await userEvent.click(screen.getByText("Samples"));
    expect(useBrowserStore.getState().activeFolder).toBe("/Users/me/Samples");
  });

  test("expand button loads and shows child directories", async () => {
    (rc.request.dbGetPinnedFolders as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples",
    ]);
    (rc.request.fsListDirs as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples/Drums",
    ]);
    render(<FolderTree />);
    await waitFor(() => screen.getByText("Samples"));
    await userEvent.click(screen.getByRole("button", { name: /expand/i }));
    await waitFor(() => expect(screen.getByText("Drums")).toBeDefined());
  });
});

describe("FolderTree — pin/unpin", () => {
  test("renders an add-folder button", () => {
    render(<FolderTree />);
    expect(screen.getByTestId("add-folder-btn")).toBeDefined();
  });

  test("clicking add-folder calls fsOpenFolderDialog", async () => {
    render(<FolderTree />);
    await userEvent.click(screen.getByTestId("add-folder-btn"));
    expect(rc.request.fsOpenFolderDialog).toHaveBeenCalledOnce();
  });

  test("selecting a folder via dialog pins it and shows it in the tree", async () => {
    (rc.request.fsOpenFolderDialog as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples",
    ]);
    render(<FolderTree />);
    await userEvent.click(screen.getByTestId("add-folder-btn"));
    expect(rc.send.dbPinFolder).toHaveBeenCalledWith({ path: "/Users/me/Samples" });
    await waitFor(() => expect(screen.getByText("Samples")).toBeDefined());
  });

  test("dialog returning multiple folders pins all of them", async () => {
    (rc.request.fsOpenFolderDialog as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Drums",
      "/Users/me/Synths",
    ]);
    render(<FolderTree />);
    await userEvent.click(screen.getByTestId("add-folder-btn"));
    expect(rc.send.dbPinFolder).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByText("Drums")).toBeDefined());
    expect(screen.getByText("Synths")).toBeDefined();
  });

  test("dialog returning empty array does not call dbPinFolder", async () => {
    render(<FolderTree />);
    await userEvent.click(screen.getByTestId("add-folder-btn"));
    await waitFor(() =>
      expect(rc.request.fsOpenFolderDialog).toHaveBeenCalledOnce(),
    );
    expect(rc.send.dbPinFolder).not.toHaveBeenCalled();
  });

  test("each pinned folder has an unpin button", async () => {
    (rc.request.dbGetPinnedFolders as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples",
    ]);
    render(<FolderTree />);
    await waitFor(() => screen.getByText("Samples"));
    expect(screen.getByRole("button", { name: /unpin/i })).toBeDefined();
  });

  test("clicking unpin calls dbUnpinFolder and removes the folder", async () => {
    (rc.request.dbGetPinnedFolders as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples",
    ]);
    render(<FolderTree />);
    await waitFor(() => screen.getByText("Samples"));
    await userEvent.click(screen.getByRole("button", { name: /unpin/i }));
    expect(rc.send.dbUnpinFolder).toHaveBeenCalledWith({ path: "/Users/me/Samples" });
    expect(screen.queryByText("Samples")).toBeNull();
  });

  test("unpinning the active folder clears activeFolder", async () => {
    useBrowserStore.setState({ activeFolder: "/Users/me/Samples" });
    (rc.request.dbGetPinnedFolders as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples",
    ]);
    render(<FolderTree />);
    await waitFor(() => screen.getByText("Samples"));
    await userEvent.click(screen.getByRole("button", { name: /unpin/i }));
    expect(useBrowserStore.getState().activeFolder).toBeNull();
  });

  test("unpinning a non-active folder does not clear activeFolder", async () => {
    useBrowserStore.setState({ activeFolder: "/Users/me/Other" });
    (rc.request.dbGetPinnedFolders as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples",
    ]);
    render(<FolderTree />);
    await waitFor(() => screen.getByText("Samples"));
    await userEvent.click(screen.getByRole("button", { name: /unpin/i }));
    expect(useBrowserStore.getState().activeFolder).toBe("/Users/me/Other");
  });

  test("selecting a folder via dialog sets it as activeFolder immediately", async () => {
    (rc.request.fsOpenFolderDialog as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples",
    ]);
    render(<FolderTree />);
    await userEvent.click(screen.getByTestId("add-folder-btn"));
    await waitFor(() =>
      expect(useBrowserStore.getState().activeFolder).toBe("/Users/me/Samples"),
    );
  });

  test("dialog is always called with empty params (macOS remembers location)", async () => {
    useBrowserStore.setState({ activeFolder: "/Users/me/Drums" });
    render(<FolderTree />);
    await userEvent.click(screen.getByTestId("add-folder-btn"));
    expect(rc.request.fsOpenFolderDialog).toHaveBeenCalledWith({});
  });
});
