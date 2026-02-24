import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";

const { mockGetPrewarmedPath } = vi.hoisted(() => ({
  mockGetPrewarmedPath: vi.fn().mockReturnValue(null),
}));

vi.mock("./useDragCopyPrewarm", () => ({
  getPrewarmedPath: mockGetPrewarmedPath,
}));

import { useSettingsStore } from "../stores/settingsStore";
import { useDragDrop } from "./useDragDrop";

const file: AudioFile = {
  path: "/Samples/kick.wav",
  name: "kick.wav",
  extension: ".wav",
  size: 1000,
  compositeId: "cid-kick",
  bpm: 128,
  key: "Am",
  keyCamelot: "8A",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPrewarmedPath.mockReturnValue(null);
  useSettingsStore.setState({
    ...useSettingsStore.getState(),
    dragPattern: "{original}",
  });
});

describe("useDragDrop", () => {
  test("uses pre-warmed path in text/uri-list when cache hits", () => {
    mockGetPrewarmedPath.mockReturnValue(
      "/tmp/crate-drag/uuid/128_Am_kick.wav",
    );
    const { result } = renderHook(() => useDragDrop(file));
    const mockDataTransfer = { setData: vi.fn(), effectAllowed: "" };
    result.current.onDragStart({
      dataTransfer: mockDataTransfer,
    } as unknown as React.DragEvent);
    expect(mockDataTransfer.setData).toHaveBeenCalledWith(
      "text/uri-list",
      "file:///tmp/crate-drag/uuid/128_Am_kick.wav",
    );
  });

  test("falls back to original file path when no cache entry", () => {
    const { result } = renderHook(() => useDragDrop(file));
    const mockDataTransfer = { setData: vi.fn(), effectAllowed: "" };
    result.current.onDragStart({
      dataTransfer: mockDataTransfer,
    } as unknown as React.DragEvent);
    expect(mockDataTransfer.setData).toHaveBeenCalledWith(
      "text/uri-list",
      `file://${file.path}`,
    );
  });

  test("passes compositeId and current dragPattern to getPrewarmedPath", () => {
    useSettingsStore.setState({
      ...useSettingsStore.getState(),
      dragPattern: "{bpm}_{original}",
    });
    const { result } = renderHook(() => useDragDrop(file));
    const mockDataTransfer = { setData: vi.fn(), effectAllowed: "" };
    result.current.onDragStart({
      dataTransfer: mockDataTransfer,
    } as unknown as React.DragEvent);
    expect(mockGetPrewarmedPath).toHaveBeenCalledWith(
      "cid-kick",
      "{bpm}_{original}",
    );
  });
});
