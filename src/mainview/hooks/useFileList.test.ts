import { vi, describe, test, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { AudioFile } from "../../shared/types";

vi.mock("../rpc", () => ({
  rpcClient: {
    request: { fsReaddir: vi.fn() },
    send: { fsStartWatch: vi.fn(), fsStopWatch: vi.fn() },
  },
}));

import { rpcClient } from "../rpc";
import { useFileList } from "./useFileList";
import { useBrowserStore } from "../stores/browserStore";

const resetStore = () =>
  useBrowserStore.setState({
    activeFolder: null,
    fileList: [],
    selectedIndex: -1,
    sortKey: "name",
    sortDir: "asc",
    filter: "",
  });

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  (rpcClient.request.fsReaddir as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe("useFileList", () => {
  test("does nothing when activeFolder is null", () => {
    renderHook(() => useFileList());
    expect(rpcClient.request.fsReaddir).not.toHaveBeenCalled();
  });

  test("calls fsReaddir with activeFolder path", async () => {
    useBrowserStore.setState({ ...useBrowserStore.getState(), activeFolder: "/Samples" });
    renderHook(() => useFileList());
    await waitFor(() =>
      expect(rpcClient.request.fsReaddir).toHaveBeenCalledWith({ path: "/Samples" }),
    );
  });

  test("sets fileList in store after loading", async () => {
    const mockFiles: AudioFile[] = [
      { path: "/Samples/kick.wav", name: "kick.wav", extension: ".wav", size: 1000 },
    ];
    (rpcClient.request.fsReaddir as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
    useBrowserStore.setState({ ...useBrowserStore.getState(), activeFolder: "/Samples" });
    renderHook(() => useFileList());
    await waitFor(() =>
      expect(useBrowserStore.getState().fileList).toEqual(mockFiles),
    );
  });

  test("starts directory watch when folder is active", async () => {
    useBrowserStore.setState({ ...useBrowserStore.getState(), activeFolder: "/Samples" });
    renderHook(() => useFileList());
    await waitFor(() =>
      expect(rpcClient.send.fsStartWatch).toHaveBeenCalledWith({ path: "/Samples" }),
    );
  });

  test("stops watch and clears fileList on unmount", async () => {
    useBrowserStore.setState({ ...useBrowserStore.getState(), activeFolder: "/Samples" });
    const { unmount } = renderHook(() => useFileList());
    await waitFor(() => expect(rpcClient.send.fsStartWatch).toHaveBeenCalled());
    unmount();
    expect(rpcClient.send.fsStopWatch).toHaveBeenCalledWith({ path: "/Samples" });
  });
});
