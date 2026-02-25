import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Tag } from "../../shared/types";

const { mockDbAddFileTag, mockDbRemoveFileTag, mockDbCreateTag } = vi.hoisted(() => ({
  mockDbAddFileTag: vi.fn(),
  mockDbCreateTag: vi.fn(),
  mockDbRemoveFileTag: vi.fn(),
}));

vi.mock("../rpc", () => ({
  rpcClient: {
    send: {
      dbAddFileTag: mockDbAddFileTag,
      dbRemoveFileTag: mockDbRemoveFileTag,
    },
    request: {
      dbCreateTag: mockDbCreateTag,
    },
  },
}));

import { TagEditor } from "./TagEditor";

const tag1: Tag = { id: 1, name: "drums", color: "#f00", sortOrder: 0 };
const tag2: Tag = { id: 2, name: "bass", color: "#0f0", sortOrder: 1 };
const tag3: Tag = { id: 3, name: "synth", color: "#00f", sortOrder: 2 };

const allTags = [tag1, tag2, tag3];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TagEditor — chips", () => {
  test("renders a chip for each initial tag", () => {
    render(<TagEditor compositeId="cid-1" initialTags={[tag1, tag2]} allTags={allTags} />);
    expect(screen.getByTestId("tag-chip-1")).toBeDefined();
    expect(screen.getByTestId("tag-chip-2")).toBeDefined();
  });

  test("chip shows tag name", () => {
    render(<TagEditor compositeId="cid-1" initialTags={[tag1]} allTags={allTags} />);
    expect(screen.getByText("drums")).toBeDefined();
  });

  test("clicking × on a chip calls dbRemoveFileTag", async () => {
    render(<TagEditor compositeId="cid-1" initialTags={[tag1]} allTags={allTags} />);
    await userEvent.click(screen.getByTestId("tag-chip-remove-1"));
    expect(mockDbRemoveFileTag).toHaveBeenCalledWith({
      compositeId: "cid-1",
      tagId: 1,
    });
  });

  test("removed tag's chip disappears from the UI", async () => {
    render(<TagEditor compositeId="cid-1" initialTags={[tag1]} allTags={allTags} />);
    await userEvent.click(screen.getByTestId("tag-chip-remove-1"));
    expect(screen.queryByTestId("tag-chip-1")).toBeNull();
  });
});

describe("TagEditor — adding tags", () => {
  test("renders the tag search input", () => {
    render(<TagEditor compositeId="cid-1" initialTags={[]} allTags={allTags} />);
    expect(screen.getByTestId("tag-search-input")).toBeDefined();
  });

  test("selecting a tag from search calls dbAddFileTag", async () => {
    render(<TagEditor compositeId="cid-1" initialTags={[]} allTags={allTags} />);
    await userEvent.type(screen.getByTestId("tag-search-input"), "d");
    await userEvent.click(screen.getByText("drums"));
    expect(mockDbAddFileTag).toHaveBeenCalledWith({
      compositeId: "cid-1",
      tagId: 1,
    });
  });

  test("selected tag chip appears in the UI", async () => {
    render(<TagEditor compositeId="cid-1" initialTags={[]} allTags={allTags} />);
    await userEvent.type(screen.getByTestId("tag-search-input"), "d");
    await userEvent.click(screen.getByText("drums"));
    expect(screen.getByTestId("tag-chip-1")).toBeDefined();
  });

  test("creating a new tag calls dbCreateTag then dbAddFileTag", async () => {
    const newTag: Tag = { id: 99, name: "newstyle", color: null, sortOrder: 0 };
    mockDbCreateTag.mockResolvedValue(newTag);

    render(<TagEditor compositeId="cid-1" initialTags={[]} allTags={allTags} />);
    await userEvent.type(screen.getByTestId("tag-search-input"), "newstyle");
    await userEvent.click(screen.getByTestId("tag-search-create"));

    await waitFor(() => {
      expect(mockDbCreateTag).toHaveBeenCalledWith({
        name: "newstyle",
        color: null,
      });
      expect(mockDbAddFileTag).toHaveBeenCalledWith({
        compositeId: "cid-1",
        tagId: 99,
      });
    });
  });
});
