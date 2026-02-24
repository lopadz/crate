import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { Tag } from "../../shared/types";
import { TagSearch } from "./TagSearch";

const allTags: Tag[] = [
  { id: 1, name: "drums", color: "#f00", sortOrder: 0 },
  { id: 2, name: "bass", color: "#0f0", sortOrder: 1 },
  { id: 3, name: "synth", color: "#00f", sortOrder: 2 },
];

describe("TagSearch", () => {
  test("renders search input", () => {
    render(
      <TagSearch allTags={allTags} onSelect={() => {}} onCreate={() => {}} />,
    );
    expect(screen.getByTestId("tag-search-input")).toBeDefined();
  });

  test("dropdown is hidden before typing", () => {
    render(
      <TagSearch allTags={allTags} onSelect={() => {}} onCreate={() => {}} />,
    );
    expect(screen.queryByTestId("tag-search-dropdown")).toBeNull();
  });

  test("typing shows matching tags in dropdown", async () => {
    render(
      <TagSearch allTags={allTags} onSelect={() => {}} onCreate={() => {}} />,
    );
    await userEvent.type(screen.getByTestId("tag-search-input"), "d");
    expect(screen.getByTestId("tag-search-dropdown")).toBeDefined();
    expect(screen.getByText("drums")).toBeDefined();
    expect(screen.queryByText("bass")).toBeNull();
  });

  test("filtering is case-insensitive", async () => {
    render(
      <TagSearch allTags={allTags} onSelect={() => {}} onCreate={() => {}} />,
    );
    await userEvent.type(screen.getByTestId("tag-search-input"), "DR");
    expect(screen.getByText("drums")).toBeDefined();
  });

  test("shows Create tag option when no exact match", async () => {
    render(
      <TagSearch allTags={allTags} onSelect={() => {}} onCreate={() => {}} />,
    );
    await userEvent.type(screen.getByTestId("tag-search-input"), "kick");
    expect(screen.getByTestId("tag-search-create")).toBeDefined();
  });

  test("does NOT show Create tag when exact match exists", async () => {
    render(
      <TagSearch allTags={allTags} onSelect={() => {}} onCreate={() => {}} />,
    );
    await userEvent.type(screen.getByTestId("tag-search-input"), "drums");
    expect(screen.queryByTestId("tag-search-create")).toBeNull();
  });

  test("clicking a tag option calls onSelect with the tag", async () => {
    const onSelect = vi.fn();
    render(
      <TagSearch allTags={allTags} onSelect={onSelect} onCreate={() => {}} />,
    );
    await userEvent.type(screen.getByTestId("tag-search-input"), "b");
    await userEvent.click(screen.getByText("bass"));
    expect(onSelect).toHaveBeenCalledWith(allTags[1]);
  });

  test("clicking Create tag calls onCreate with input value", async () => {
    const onCreate = vi.fn();
    render(
      <TagSearch allTags={allTags} onSelect={() => {}} onCreate={onCreate} />,
    );
    await userEvent.type(screen.getByTestId("tag-search-input"), "newstyle");
    await userEvent.click(screen.getByTestId("tag-search-create"));
    expect(onCreate).toHaveBeenCalledWith("newstyle");
  });

  test("Escape key clears input and closes dropdown", async () => {
    render(
      <TagSearch allTags={allTags} onSelect={() => {}} onCreate={() => {}} />,
    );
    await userEvent.type(screen.getByTestId("tag-search-input"), "bass");
    await userEvent.keyboard("{Escape}");
    expect(
      (screen.getByTestId("tag-search-input") as HTMLInputElement).value,
    ).toBe("");
    expect(screen.queryByTestId("tag-search-dropdown")).toBeNull();
  });

  test("excludeIds hides already-assigned tags from dropdown", async () => {
    render(
      <TagSearch
        allTags={allTags}
        excludeIds={[1]}
        onSelect={() => {}}
        onCreate={() => {}}
      />,
    );
    await userEvent.type(screen.getByTestId("tag-search-input"), "d");
    expect(screen.queryByText("drums")).toBeNull();
  });
});
