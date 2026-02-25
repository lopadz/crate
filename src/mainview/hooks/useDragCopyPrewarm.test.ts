import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";

const { mockDawCreateDragCopy } = vi.hoisted(() => ({
  mockDawCreateDragCopy: vi.fn().mockResolvedValue("/tmp/crate-drag/uuid/kick.wav"),
}));

vi.mock("../rpc", () => ({
  rpcClient: {
    request: { dawCreateDragCopy: mockDawCreateDragCopy },
  },
}));

import { useBrowserStore } from "../stores/browserStore";
import { useSettingsStore } from "../stores/settingsStore";
import { getPrewarmedPath, resetPrewarmCache, useDragCopyPrewarm } from "./useDragCopyPrewarm";

const fileA: AudioFile = {
  path: "/Samples/kick.wav",
  name: "kick.wav",
  extension: ".wav",
  size: 1000,
  compositeId: "cid-kick",
  bpm: 128,
  key: "Am",
  keyCamelot: "8A",
};

const fileB: AudioFile = {
  path: "/Samples/snare.wav",
  name: "snare.wav",
  extension: ".wav",
  size: 1000,
  compositeId: "cid-snare",
};

beforeEach(() => {
  vi.clearAllMocks();
  resetPrewarmCache();
  useBrowserStore.setState({
    ...useBrowserStore.getState(),
    fileList: [fileA, fileB],
    selectedIndex: 0,
  });
  useSettingsStore.setState({
    ...useSettingsStore.getState(),
    dragPattern: "{original}",
  });
});

describe("useDragCopyPrewarm", () => {
  test("calls dawCreateDragCopy for selected file on mount", async () => {
    renderHook(() => useDragCopyPrewarm());
    await waitFor(() =>
      expect(mockDawCreateDragCopy).toHaveBeenCalledWith({
        path: fileA.path,
        pattern: "{original}",
        bpm: fileA.bpm,
        key: fileA.key,
        keyCamelot: fileA.keyCamelot,
      }),
    );
  });

  test("calls dawCreateDragCopy again when selected file changes", async () => {
    renderHook(() => useDragCopyPrewarm());
    await waitFor(() => expect(mockDawCreateDragCopy).toHaveBeenCalledTimes(1));
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      selectedIndex: 1,
    });
    await waitFor(() =>
      expect(mockDawCreateDragCopy).toHaveBeenCalledWith(
        expect.objectContaining({ path: fileB.path }),
      ),
    );
  });

  test("calls dawCreateDragCopy again when dragPattern changes", async () => {
    renderHook(() => useDragCopyPrewarm());
    await waitFor(() => expect(mockDawCreateDragCopy).toHaveBeenCalledTimes(1));
    useSettingsStore.setState({
      ...useSettingsStore.getState(),
      dragPattern: "{bpm}_{original}",
    });
    await waitFor(() =>
      expect(mockDawCreateDragCopy).toHaveBeenCalledWith(
        expect.objectContaining({ pattern: "{bpm}_{original}" }),
      ),
    );
  });

  test("getPrewarmedPath returns cached temp path on hit", async () => {
    mockDawCreateDragCopy.mockResolvedValue("/tmp/crate-drag/uuid/kick.wav");
    renderHook(() => useDragCopyPrewarm());
    await waitFor(() =>
      expect(getPrewarmedPath("cid-kick", "{original}")).toBe("/tmp/crate-drag/uuid/kick.wav"),
    );
  });

  test("getPrewarmedPath returns null when cache is empty", () => {
    expect(getPrewarmedPath("cid-kick", "{original}")).toBeNull();
  });

  test("getPrewarmedPath returns null when pattern does not match cached entry", async () => {
    renderHook(() => useDragCopyPrewarm());
    await waitFor(() => expect(mockDawCreateDragCopy).toHaveBeenCalled());
    expect(getPrewarmedPath("cid-kick", "{bpm}_{original}")).toBeNull();
  });

  test("does not re-call dawCreateDragCopy when same file+pattern is already cached", async () => {
    mockDawCreateDragCopy.mockResolvedValue("/tmp/crate-drag/uuid/kick.wav");
    renderHook(() => useDragCopyPrewarm());
    await waitFor(() => expect(mockDawCreateDragCopy).toHaveBeenCalledTimes(1));
    // Switch to B then back to A — A is no longer in single-entry cache so it
    // re-creates. But a second render without any dep change must NOT re-call.
    mockDawCreateDragCopy.mockClear();
    // Trigger a re-render with identical deps by setting unrelated store state
    useBrowserStore.setState({ ...useBrowserStore.getState() });
    await new Promise((r) => setTimeout(r, 20));
    expect(mockDawCreateDragCopy).not.toHaveBeenCalled();
  });
});
