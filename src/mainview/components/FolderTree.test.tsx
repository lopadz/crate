import { vi, describe, test, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../rpc", () => ({
  rpcClient: {
    request: { dbGetPinnedFolders: vi.fn(), fsListDirs: vi.fn() },
    send: { dbPinFolder: vi.fn(), dbUnpinFolder: vi.fn() },
  },
}));

import { rpcClient } from "../rpc";
import { FolderTree } from "./FolderTree";
import { useBrowserStore } from "../stores/browserStore";

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
  (rpcClient.request.dbGetPinnedFolders as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (rpcClient.request.fsListDirs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe("FolderTree", () => {
  test("renders without crashing", () => {
    render(<FolderTree />);
    expect(screen.getByTestId("folder-tree")).toBeDefined();
  });

  test("shows pinned folder names", async () => {
    (rpcClient.request.dbGetPinnedFolders as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples",
    ]);
    render(<FolderTree />);
    await waitFor(() => expect(screen.getByText("Samples")).toBeDefined());
  });

  test("clicking a folder name sets activeFolder", async () => {
    (rpcClient.request.dbGetPinnedFolders as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples",
    ]);
    render(<FolderTree />);
    await waitFor(() => screen.getByText("Samples"));
    await userEvent.click(screen.getByText("Samples"));
    expect(useBrowserStore.getState().activeFolder).toBe("/Users/me/Samples");
  });

  test("expand button loads and shows child directories", async () => {
    (rpcClient.request.dbGetPinnedFolders as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples",
    ]);
    (rpcClient.request.fsListDirs as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/Users/me/Samples/Drums",
    ]);
    render(<FolderTree />);
    await waitFor(() => screen.getByText("Samples"));
    await userEvent.click(screen.getByRole("button", { name: /expand/i }));
    await waitFor(() => expect(screen.getByText("Drums")).toBeDefined());
  });
});
