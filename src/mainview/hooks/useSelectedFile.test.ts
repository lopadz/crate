import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import type { AudioFile } from "../../shared/types";
import { useBrowserStore } from "../stores/browserStore";
import { useSelectedFile } from "./useSelectedFile";

const fileA: AudioFile = { path: "/S/a.wav", name: "a.wav", extension: ".wav", size: 100 };
const fileB: AudioFile = { path: "/S/b.wav", name: "b.wav", extension: ".wav", size: 200 };

beforeEach(() => {
  useBrowserStore.setState({
    activeFolder: "/S",
    fileList: [fileA, fileB],
    selectedIndex: -1,
    sortKey: "name",
    sortDir: "asc",
    filter: "",
  });
});

describe("useSelectedFile", () => {
  test("returns undefined when selectedIndex is -1", () => {
    const { result } = renderHook(() => useSelectedFile());
    expect(result.current).toBeUndefined();
  });

  test("returns the file at selectedIndex", () => {
    useBrowserStore.setState({ ...useBrowserStore.getState(), selectedIndex: 0 });
    const { result } = renderHook(() => useSelectedFile());
    expect(result.current).toBe(fileA);
  });

  test("returns the correct file when selectedIndex points to the second item", () => {
    useBrowserStore.setState({ ...useBrowserStore.getState(), selectedIndex: 1 });
    const { result } = renderHook(() => useSelectedFile());
    expect(result.current).toBe(fileB);
  });

  test("updates reactively when selectedIndex changes", () => {
    const { result } = renderHook(() => useSelectedFile());
    expect(result.current).toBeUndefined();
    act(() => useBrowserStore.setState({ ...useBrowserStore.getState(), selectedIndex: 1 }));
    expect(result.current).toBe(fileB);
  });

  test("updates reactively when fileList changes", () => {
    useBrowserStore.setState({ ...useBrowserStore.getState(), selectedIndex: 0 });
    const { result } = renderHook(() => useSelectedFile());
    expect(result.current).toBe(fileA);
    const fileC: AudioFile = { path: "/S/c.wav", name: "c.wav", extension: ".wav", size: 300 };
    act(() => useBrowserStore.setState({ ...useBrowserStore.getState(), fileList: [fileC] }));
    expect(result.current).toBe(fileC);
  });

  test("returns undefined when selectedIndex is out of bounds", () => {
    useBrowserStore.setState({ ...useBrowserStore.getState(), selectedIndex: 99 });
    const { result } = renderHook(() => useSelectedFile());
    expect(result.current).toBeUndefined();
  });
});
