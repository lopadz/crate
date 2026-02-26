import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { FolderTemplate } from "../../bun/folderOrganizer";
import { FolderTemplateEditor } from "./FolderTemplateEditor";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTemplate(overrides?: Partial<FolderTemplate>): FolderTemplate {
  return {
    name: "My Template",
    rules: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FolderTemplateEditor", () => {
  test("editing the name input calls onChange with the new name", () => {
    const onChange = vi.fn();
    render(<FolderTemplateEditor template={makeTemplate()} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("template-name-input"), {
      target: { value: "Percussion" },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Percussion" }));
  });

  test("'Remove' button removes the rule and calls onChange", async () => {
    const onChange = vi.fn();
    const template = makeTemplate({ rules: [{ tags: ["kick"], targetPath: "Drums" }] });
    render(<FolderTemplateEditor template={template} onChange={onChange} />);
    await userEvent.click(screen.getByTestId("remove-rule-button"));
    expect(onChange).toHaveBeenCalledWith({ name: "My Template", rules: [] });
  });

  test("editing tag input calls onChange with updated tags", () => {
    const onChange = vi.fn();
    const template = makeTemplate({ rules: [{ tags: ["kick"], targetPath: "Drums" }] });
    render(<FolderTemplateEditor template={template} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("rule-tags-input"), { target: { value: "snare" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ rules: [expect.objectContaining({ tags: ["snare"] })] }),
    );
  });

  test("'Add rule' button appends an empty rule and calls onChange", async () => {
    const onChange = vi.fn();
    render(<FolderTemplateEditor template={makeTemplate()} onChange={onChange} />);
    await userEvent.click(screen.getByTestId("add-rule-button"));
    expect(onChange).toHaveBeenCalledWith({
      name: "My Template",
      rules: [{ tags: [], targetPath: "" }],
    });
  });

  test("each rule row has a tag input and a target path input", () => {
    const template = makeTemplate({ rules: [{ tags: ["kick"], targetPath: "Drums" }] });
    render(<FolderTemplateEditor template={template} onChange={vi.fn()} />);
    expect(screen.getByTestId("rule-tags-input")).toBeDefined();
    expect(screen.getByTestId("rule-target-input")).toBeDefined();
  });

  test("renders one row per rule", () => {
    const template = makeTemplate({
      rules: [
        { tags: ["kick"], targetPath: "Drums/Kicks" },
        { tags: ["snare"], targetPath: "Drums/Snares" },
      ],
    });
    render(<FolderTemplateEditor template={template} onChange={vi.fn()} />);
    expect(screen.getAllByTestId("rule-row")).toHaveLength(2);
  });

  test("renders an input for the template name", () => {
    render(<FolderTemplateEditor template={makeTemplate()} onChange={vi.fn()} />);
    const input = screen.getByTestId("template-name-input") as HTMLInputElement;
    expect(input.value).toBe("My Template");
  });
});
