import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";

const { mockPreload } = vi.hoisted(() => ({
  mockPreload: vi.fn(),
}));

vi.mock("../services/audioEngine", () => ({
  audioEngine: { preload: mockPreload },
}));

import { useBrowserStore } from "../stores/browserStore";
import { useFilePreload } from "./useFilePreload";

const files: AudioFile[] = [
  { path: "/S/a.wav", name: "a.wav", extension: ".wav", size: 100 },
  { path: "/S/b.wav", name: "b.wav", extension: ".wav", size: 100 },
];

beforeEach(() => {
  vi.clearAllMocks();
  useBrowserStore.setState({
    activeFolder: "/S",
    fileList: files,
    selectedIndex: -1,
    sortKey: "name",
    sortDir: "asc",
    filter: "",
  });
});

describe("useFilePreload", () => {
  test("calls audioEngine.preload when selectedIndex changes to a valid index", () => {
    renderHook(() => useFilePreload());
    act(() =>
      useBrowserStore.setState({
        ...useBrowserStore.getState(),
        selectedIndex: 0,
      }),
    );
    expect(mockPreload).toHaveBeenCalledWith(files[0]);
  });

  test("calls preload with the newly selected file when navigating", () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      selectedIndex: 0,
    });
    renderHook(() => useFilePreload());
    act(() =>
      useBrowserStore.setState({
        ...useBrowserStore.getState(),
        selectedIndex: 1,
      }),
    );
    expect(mockPreload).toHaveBeenCalledWith(files[1]);
  });

  test("does not call preload when selectedIndex stays the same", () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      selectedIndex: 0,
    });
    renderHook(() => useFilePreload());
    act(() =>
      useBrowserStore.setState({
        ...useBrowserStore.getState(),
        selectedIndex: 0,
      }),
    );
    expect(mockPreload).not.toHaveBeenCalled();
  });

  test("does not call preload when selectedIndex is -1", () => {
    renderHook(() => useFilePreload());
    act(() =>
      useBrowserStore.setState({
        ...useBrowserStore.getState(),
        selectedIndex: -1,
      }),
    );
    expect(mockPreload).not.toHaveBeenCalled();
  });
});
