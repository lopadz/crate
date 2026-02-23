import { vi, describe, test, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../rpc", () => ({
  rpcClient: {
    request: { dbGetPinnedFolders: vi.fn(), fsListDirs: vi.fn(), fsGetHomeDir: vi.fn(), fsReaddir: vi.fn() },
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
  (rc.request.fsGetHomeDir as ReturnType<typeof vi.fn>).mockResolvedValue("/Users/me");
  (rc.request.fsReaddir as ReturnType<typeof vi.fn>).mockResolvedValue([]);
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

  test("clicking add-folder shows the FolderPicker at the home directory", async () => {
    render(<FolderTree />);
    await userEvent.click(screen.getByTestId("add-folder-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("folder-picker-path").textContent).toContain("/Users/me"),
    );
  });

  test("pinning from FolderPicker calls dbPinFolder, shows the folder, and closes picker", async () => {
    (rc.request.fsListDirs as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Kicks",
    ]);
    render(<FolderTree />);
    await userEvent.click(screen.getByTestId("add-folder-btn"));
    await waitFor(() => screen.getByText("Kicks"));
    await userEvent.click(screen.getByText("Kicks"));
    await userEvent.click(screen.getByTestId("folder-picker-pin"));
    expect(rc.send.dbPinFolder).toHaveBeenCalledWith({ path: "/Users/me/Kicks" });
    await waitFor(() => expect(screen.queryByTestId("folder-picker")).toBeNull());
    expect(screen.getByText("Kicks")).toBeDefined();
  });

  test("cancelling FolderPicker closes it without pinning", async () => {
    render(<FolderTree />);
    await userEvent.click(screen.getByTestId("add-folder-btn"));
    expect(screen.getByTestId("folder-picker")).toBeDefined();
    await userEvent.click(screen.getByTestId("folder-picker-cancel"));
    expect(rc.send.dbPinFolder).not.toHaveBeenCalled();
    expect(screen.queryByTestId("folder-picker")).toBeNull();
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
});
