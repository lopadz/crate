import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";

vi.mock("../rpc", () => ({
  rpcClient: {
    request: { fsReaddir: vi.fn() },
    send: { fsStartWatch: vi.fn(), fsStopWatch: vi.fn() },
  },
}));

import { rpcClient } from "../rpc";
import { useAnalysisStore } from "../stores/analysisStore";
import { useBrowserStore } from "../stores/browserStore";
import { useFileList } from "./useFileList";

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
  useAnalysisStore.setState({
    queueStatus: { pending: 0, running: 0, total: 0 },
    fileStatuses: {},
  });
  (rpcClient?.request.fsReaddir as ReturnType<typeof vi.fn>).mockResolvedValue(
    [],
  );
});

describe("useFileList", () => {
  test("does nothing when activeFolder is null", () => {
    renderHook(() => useFileList());
    expect(rpcClient?.request.fsReaddir).not.toHaveBeenCalled();
  });

  test("calls fsReaddir with activeFolder path", async () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/Samples",
    });
    renderHook(() => useFileList());
    await waitFor(() =>
      expect(rpcClient?.request.fsReaddir).toHaveBeenCalledWith({
        path: "/Samples",
      }),
    );
  });

  test("sets fileList in store after loading", async () => {
    const mockFiles: AudioFile[] = [
      {
        path: "/Samples/kick.wav",
        name: "kick.wav",
        extension: ".wav",
        size: 1000,
      },
    ];
    (
      rpcClient?.request.fsReaddir as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockFiles);
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/Samples",
    });
    renderHook(() => useFileList());
    await waitFor(() =>
      expect(useBrowserStore.getState().fileList).toEqual(mockFiles),
    );
  });

  test("starts directory watch when folder is active", async () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/Samples",
    });
    renderHook(() => useFileList());
    await waitFor(() =>
      expect(rpcClient?.send.fsStartWatch).toHaveBeenCalledWith({
        path: "/Samples",
      }),
    );
  });

  test("stops watch and clears fileList on unmount", async () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/Samples",
    });
    const { unmount } = renderHook(() => useFileList());
    await waitFor(() =>
      expect(rpcClient?.send.fsStartWatch).toHaveBeenCalled(),
    );
    unmount();
    expect(rpcClient?.send.fsStopWatch).toHaveBeenCalledWith({
      path: "/Samples",
    });
  });

  test("sets analysis status to queued for files without lufsIntegrated", async () => {
    const mockFiles: AudioFile[] = [
      {
        path: "/S/a.wav",
        name: "a.wav",
        extension: ".wav",
        size: 100,
        compositeId: "cid-a",
      },
    ];
    (
      rpcClient?.request.fsReaddir as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockFiles);
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/S",
    });
    renderHook(() => useFileList());
    await waitFor(() =>
      expect(useAnalysisStore.getState().fileStatuses["cid-a"]).toBe("queued"),
    );
  });

  test("sets analysis status to done for files with lufsIntegrated", async () => {
    const mockFiles: AudioFile[] = [
      {
        path: "/S/b.wav",
        name: "b.wav",
        extension: ".wav",
        size: 100,
        compositeId: "cid-b",
        lufsIntegrated: -14,
      },
    ];
    (
      rpcClient?.request.fsReaddir as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockFiles);
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/S",
    });
    renderHook(() => useFileList());
    await waitFor(() =>
      expect(useAnalysisStore.getState().fileStatuses["cid-b"]).toBe("done"),
    );
  });

  test("skips files without compositeId when setting analysis status", async () => {
    const mockFiles: AudioFile[] = [
      { path: "/S/c.wav", name: "c.wav", extension: ".wav", size: 100 },
    ];
    (
      rpcClient?.request.fsReaddir as ReturnType<typeof vi.fn>
    ).mockResolvedValue(mockFiles);
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/S",
    });
    renderHook(() => useFileList());
    await waitFor(() =>
      expect(useBrowserStore.getState().fileList).toEqual(mockFiles),
    );
    expect(Object.keys(useAnalysisStore.getState().fileStatuses)).toHaveLength(
      0,
    );
  });
});
