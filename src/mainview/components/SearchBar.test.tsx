import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";

const { mockDbSearchFiles, mockFsReaddir } = vi.hoisted(() => ({
  mockDbSearchFiles: vi.fn().mockResolvedValue([]),
  mockFsReaddir: vi.fn().mockResolvedValue([]),
}));

vi.mock("../rpc", () => ({
  rpcClient: {
    request: {
      dbSearchFiles: mockDbSearchFiles,
      fsReaddir: mockFsReaddir,
    },
  },
}));

import { useBrowserStore } from "../stores/browserStore";
import { SearchBar } from "./SearchBar";

beforeEach(() => {
  vi.clearAllMocks();
  useBrowserStore.setState({
    ...useBrowserStore.getState(),
    activeFolder: "/Samples",
    fileList: [],
    selectedIndex: -1,
  });
});

describe("SearchBar", () => {
  test("renders search input", () => {
    render(<SearchBar />);
    expect(screen.getByTestId("search-bar-input")).toBeDefined();
  });

  test("typing calls dbSearchFiles RPC with the query", async () => {
    render(<SearchBar debounceMs={0} />);
    fireEvent.change(screen.getByTestId("search-bar-input"), {
      target: { value: "dark" },
    });
    await waitFor(() =>
      expect(mockDbSearchFiles).toHaveBeenCalledWith({ query: "dark" }),
    );
  });

  test("search results replace fileList in browserStore", async () => {
    const mockFiles: AudioFile[] = [
      {
        path: "/Samples/dark.wav",
        name: "dark.wav",
        extension: ".wav",
        size: 100,
        compositeId: "cid-1",
      },
    ];
    mockDbSearchFiles.mockResolvedValue(mockFiles);
    render(<SearchBar debounceMs={0} />);
    fireEvent.change(screen.getByTestId("search-bar-input"), {
      target: { value: "dark" },
    });
    await waitFor(() =>
      expect(useBrowserStore.getState().fileList).toEqual(mockFiles),
    );
  });

  test("clearing the input calls fsReaddir with activeFolder", async () => {
    render(<SearchBar debounceMs={0} />);
    const input = screen.getByTestId("search-bar-input");
    fireEvent.change(input, { target: { value: "dark" } });
    await waitFor(() => expect(mockDbSearchFiles).toHaveBeenCalled());
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() =>
      expect(mockFsReaddir).toHaveBeenCalledWith({ path: "/Samples" }),
    );
  });
});
