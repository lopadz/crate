import { vi, describe, test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AudioFile } from "../../shared/types";

// Mock @tanstack/virtual-core so the virtualizer renders all items
// without needing real DOM layout measurement
vi.mock("@tanstack/virtual-core", () => {
  class MockVirtualizer {
    private count = 0;
    constructor(opts: { count: number; onChange?: () => void }) {
      this.count = opts.count;
    }
    setOptions(opts: { count: number }) {
      this.count = opts.count;
    }
    _didMount() {
      return () => {};
    }
    _willUpdate() {}
    getVirtualItems() {
      return Array.from({ length: this.count }, (_, i) => ({
        index: i,
        key: i,
        start: i * 36,
        end: (i + 1) * 36,
        size: 36,
        lane: 0,
      }));
    }
    getTotalSize() {
      return this.count * 36;
    }
  }
  return {
    Virtualizer: MockVirtualizer,
    observeElementRect: () => () => {},
    observeElementOffset: () => () => {},
    elementScroll: () => {},
    measureElement: () => 36,
  };
});

import { FileList } from "./FileList";
import { useBrowserStore } from "../stores/browserStore";

const sampleFiles: AudioFile[] = [
  { path: "/S/kick.wav", name: "kick.wav", extension: ".wav", size: 100_000 },
  { path: "/S/snare.mp3", name: "snare.mp3", extension: ".mp3", size: 200_000 },
  { path: "/S/hat.flac", name: "hat.flac", extension: ".flac", size: 300_000 },
];

const resetStore = () =>
  useBrowserStore.setState({
    activeFolder: null,
    fileList: [],
    selectedIndex: -1,
    sortKey: "name",
    sortDir: "asc",
    filter: "",
  });

beforeEach(resetStore);

describe("FileList", () => {
  test("renders with file-list testid", () => {
    render(<FileList />);
    expect(screen.getByTestId("file-list")).toBeDefined();
  });

  test("shows prompt when no folder is active", () => {
    render(<FileList />);
    expect(screen.getByText(/select a folder/i)).toBeDefined();
  });

  test("shows empty message when folder has no files", () => {
    useBrowserStore.setState({ ...useBrowserStore.getState(), activeFolder: "/Samples" });
    render(<FileList />);
    expect(screen.getByText(/no audio files/i)).toBeDefined();
  });

  test("renders a row for each file", () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/Samples",
      fileList: sampleFiles,
    });
    render(<FileList />);
    expect(screen.getAllByTestId("file-row")).toHaveLength(3);
  });

  test("clicking a row sets selectedIndex in the store", async () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/Samples",
      fileList: sampleFiles,
    });
    render(<FileList />);
    const rows = screen.getAllByTestId("file-row");
    await userEvent.click(rows[1]);
    expect(useBrowserStore.getState().selectedIndex).toBe(1);
  });

  test("selected row has selected class", () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/Samples",
      fileList: sampleFiles,
      selectedIndex: 2,
    });
    render(<FileList />);
    const rows = screen.getAllByTestId("file-row");
    expect(rows[2].className).toContain("selected");
    expect(rows[0].className).not.toContain("selected");
  });
});
