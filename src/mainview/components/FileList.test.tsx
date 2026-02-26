import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";

vi.mock("../rpc", () => ({
  rpcClient: { send: { dbSetColorTag: vi.fn() } },
}));

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

import { useBrowserStore } from "../stores/browserStore";
import { FileList } from "./FileList";

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
    sessionFilter: { bpm: null, key: null },
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
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/Samples",
    });
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

describe("FileList — column header", () => {
  beforeEach(() => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/Samples",
      fileList: sampleFiles,
    });
  });

  test("renders column header row when files are present", () => {
    render(<FileList />);
    expect(screen.getByTestId("column-header")).toBeDefined();
  });

  test("column header shows BPM, Key, LUFS, Rating labels", () => {
    render(<FileList />);
    const header = screen.getByTestId("column-header");
    expect(header.textContent).toContain("BPM");
    expect(header.textContent).toContain("Key");
    expect(header.textContent).toContain("LUFS");
    expect(header.textContent).toContain("Rating");
  });

  test("column header not shown when no folder is active", () => {
    useBrowserStore.setState({ ...useBrowserStore.getState(), activeFolder: null });
    render(<FileList />);
    expect(screen.queryByTestId("column-header")).toBeNull();
  });
});

describe("FileList — session filter", () => {
  // a: 128 BPM, Am key   — BPM IN range, key compatible with Am
  // b: 121 BPM, Bb key   — BPM IN range (128±7.68), key NOT compatible with Am
  // c:  95 BPM, C  key   — BPM OUT of range, key compatible with Am (C = 8B)
  const filesWithMetadata: AudioFile[] = [
    {
      path: "/S/a.wav",
      name: "a.wav",
      extension: ".wav",
      size: 100,
      compositeId: "cid-a",
      bpm: 128,
      key: "Am",
    },
    {
      path: "/S/b.wav",
      name: "b.wav",
      extension: ".wav",
      size: 100,
      compositeId: "cid-b",
      bpm: 121,
      key: "Bb",
    },
    {
      path: "/S/c.wav",
      name: "c.wav",
      extension: ".wav",
      size: 100,
      compositeId: "cid-c",
      bpm: 95,
      key: "C",
    },
  ];

  beforeEach(() => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/S",
      fileList: filesWithMetadata,
      sessionFilter: { bpm: null, key: null },
    });
  });

  test("no filter shows all files", () => {
    render(<FileList />);
    expect(screen.getAllByTestId("file-row")).toHaveLength(3);
  });

  test("BPM filter ±6% shows only files in range", () => {
    // 128 * 0.06 = 7.68 → range [120.32, 135.68] → a(128) IN, b(121) IN, c(95) OUT
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      sessionFilter: { bpm: 128, key: null },
    });
    render(<FileList />);
    expect(screen.getAllByTestId("file-row")).toHaveLength(2);
    expect(screen.getByText("a.wav")).toBeDefined();
    expect(screen.getByText("b.wav")).toBeDefined();
  });

  test("key filter shows Camelot-compatible files only", () => {
    // Am (8A) compatible: Am, Dm, Em, C, F, G → a(Am) IN, b(Bb) OUT, c(C) IN
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      sessionFilter: { bpm: null, key: "Am" },
    });
    render(<FileList />);
    expect(screen.getAllByTestId("file-row")).toHaveLength(2);
    expect(screen.getByText("a.wav")).toBeDefined();
    expect(screen.getByText("c.wav")).toBeDefined();
  });

  test("combined BPM + key filter shows intersection", () => {
    // BPM 128: a(128) IN, b(121) IN, c(95) OUT
    // Key Am:  a(Am)  IN, b(Bb)  OUT, c(C)  IN
    // Combined: only a passes both
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      sessionFilter: { bpm: 128, key: "Am" },
    });
    render(<FileList />);
    expect(screen.getAllByTestId("file-row")).toHaveLength(1);
    expect(screen.getByText("a.wav")).toBeDefined();
  });
});
