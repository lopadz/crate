import { beforeEach, describe, expect, test } from "vitest";
import type { AudioFile } from "../../shared/types";
import { useBrowserStore } from "./browserStore";

const file = (name: string, compositeId?: string): AudioFile => ({
  path: `/samples/${name}`,
  name,
  extension: ".wav",
  size: 1000,
  compositeId,
});

beforeEach(() => {
  useBrowserStore.setState({
    activeFolder: null,
    fileList: [],
    selectedIndex: -1,
    sortKey: "name",
    sortDir: "asc",
    filter: "",
    sessionFilter: { bpm: null, key: null },
  });
});

describe("browserStore — folder / file list", () => {
  test("setActiveFolder updates activeFolder", () => {
    useBrowserStore.getState().setActiveFolder("/samples");
    expect(useBrowserStore.getState().activeFolder).toBe("/samples");
  });

  test("setFileList replaces file list; resets selection when nothing was selected", () => {
    const files = [file("kick.wav"), file("snare.wav")];
    useBrowserStore.getState().setFileList(files);
    const s = useBrowserStore.getState();
    expect(s.fileList).toHaveLength(2);
    expect(s.selectedIndex).toBe(-1);
  });

  test("setFileList preserves selection when the selected file is still present (compositeId match)", () => {
    const kick = { ...file("kick.wav"), compositeId: "cid-kick" };
    const snare = { ...file("snare.wav"), compositeId: "cid-snare" };
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      fileList: [kick, snare],
      selectedIndex: 1, // snare is selected
    });
    // Refresh list with same files (e.g. directory-change event)
    const refreshed = [
      { ...kick, bpm: 120 },
      { ...snare, bpm: 95 },
    ];
    useBrowserStore.getState().setFileList(refreshed);
    expect(useBrowserStore.getState().selectedIndex).toBe(1); // snare still selected
  });

  test("setFileList resets selection when the selected file is no longer in the list", () => {
    const kick = { ...file("kick.wav"), compositeId: "cid-kick" };
    const snare = { ...file("snare.wav"), compositeId: "cid-snare" };
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      fileList: [kick, snare],
      selectedIndex: 1,
    });
    // Navigate away — snare is not in new list
    useBrowserStore.getState().setFileList([file("hat.wav", "cid-hat")]);
    expect(useBrowserStore.getState().selectedIndex).toBe(-1);
  });
});

describe("browserStore — selection", () => {
  beforeEach(() => {
    useBrowserStore
      .getState()
      .setFileList([file("a.wav"), file("b.wav"), file("c.wav")]);
  });

  test("setSelectedIndex sets index", () => {
    useBrowserStore.getState().setSelectedIndex(1);
    expect(useBrowserStore.getState().selectedIndex).toBe(1);
  });

  test("selectNext increments index", () => {
    useBrowserStore.getState().setSelectedIndex(0);
    useBrowserStore.getState().selectNext();
    expect(useBrowserStore.getState().selectedIndex).toBe(1);
  });

  test("selectNext does not exceed last index", () => {
    useBrowserStore.getState().setSelectedIndex(2);
    useBrowserStore.getState().selectNext();
    expect(useBrowserStore.getState().selectedIndex).toBe(2);
  });

  test("selectPrev decrements index", () => {
    useBrowserStore.getState().setSelectedIndex(2);
    useBrowserStore.getState().selectPrev();
    expect(useBrowserStore.getState().selectedIndex).toBe(1);
  });

  test("selectPrev does not go below 0", () => {
    useBrowserStore.getState().setSelectedIndex(0);
    useBrowserStore.getState().selectPrev();
    expect(useBrowserStore.getState().selectedIndex).toBe(0);
  });
});

describe("browserStore — sort & filter", () => {
  test("setSortKey updates sortKey", () => {
    useBrowserStore.getState().setSortKey("size");
    expect(useBrowserStore.getState().sortKey).toBe("size");
  });

  test("setSortDir updates sortDir", () => {
    useBrowserStore.getState().setSortDir("desc");
    expect(useBrowserStore.getState().sortDir).toBe("desc");
  });

  test("setFilter updates filter string", () => {
    useBrowserStore.getState().setFilter("kick");
    expect(useBrowserStore.getState().filter).toBe("kick");
  });
});

describe("browserStore — session filter", () => {
  test("sessionFilter defaults to { bpm: null, key: null }", () => {
    expect(useBrowserStore.getState().sessionFilter).toEqual({
      bpm: null,
      key: null,
    });
  });

  test("setSessionFilter updates both fields", () => {
    useBrowserStore.getState().setSessionFilter({ bpm: 128, key: "Am" });
    expect(useBrowserStore.getState().sessionFilter).toEqual({
      bpm: 128,
      key: "Am",
    });
  });

  test("setSessionFilter with nulls clears the filter", () => {
    useBrowserStore.getState().setSessionFilter({ bpm: 128, key: "Am" });
    useBrowserStore.getState().setSessionFilter({ bpm: null, key: null });
    expect(useBrowserStore.getState().sessionFilter).toEqual({
      bpm: null,
      key: null,
    });
  });
});

describe("browserStore — color tagging", () => {
  beforeEach(() => {
    useBrowserStore.setState({
      activeFolder: "/S",
      fileList: [file("a.wav", "cid-a"), file("b.wav", "cid-b")],
      selectedIndex: 0,
      sortKey: "name",
      sortDir: "asc",
      filter: "",
    });
  });

  test("setColorTag updates colorTag on the matching file by compositeId", () => {
    useBrowserStore.getState().setColorTag("cid-a", "green");
    expect(useBrowserStore.getState().fileList[0].colorTag).toBe("green");
  });

  test("setColorTag does not affect other files", () => {
    useBrowserStore.getState().setColorTag("cid-a", "red");
    expect(useBrowserStore.getState().fileList[1].colorTag).toBeUndefined();
  });

  test("setColorTag can clear a tag to null", () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      fileList: [
        { ...file("a.wav", "cid-a"), colorTag: "green" },
        file("b.wav", "cid-b"),
      ],
    });
    useBrowserStore.getState().setColorTag("cid-a", null);
    expect(useBrowserStore.getState().fileList[0].colorTag).toBeNull();
  });
});

describe("browserStore — setRating", () => {
  test("setRating updates the rating for a matching file", () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      fileList: [file("a.wav", "cid-a"), file("b.wav", "cid-b")],
    });
    useBrowserStore.getState().setRating("cid-a", 5);
    expect(useBrowserStore.getState().fileList[0].rating).toBe(5);
    expect(useBrowserStore.getState().fileList[1].rating).toBeUndefined();
  });

  test("setRating with value 0 clears rating to undefined", () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      fileList: [{ ...file("a.wav", "cid-a"), rating: 4 }],
    });
    useBrowserStore.getState().setRating("cid-a", 0);
    expect(useBrowserStore.getState().fileList[0].rating).toBeUndefined();
  });
});
