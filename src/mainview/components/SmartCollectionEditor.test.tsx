import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SmartCollectionEditor } from "./SmartCollectionEditor";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SmartCollectionEditor — rendering", () => {
  test("renders name input", () => {
    render(<SmartCollectionEditor onSave={() => {}} />);
    expect(screen.getByTestId("collection-name-input")).toBeDefined();
  });

  test("renders BPM min and max inputs", () => {
    render(<SmartCollectionEditor onSave={() => {}} />);
    expect(screen.getByTestId("collection-bpm-min")).toBeDefined();
    expect(screen.getByTestId("collection-bpm-max")).toBeDefined();
  });

  test("renders save button", () => {
    render(<SmartCollectionEditor onSave={() => {}} />);
    expect(screen.getByTestId("collection-save-btn")).toBeDefined();
  });
});

describe("SmartCollectionEditor — save", () => {
  test("save with name only calls onSave with null queryJson", async () => {
    const onSave = vi.fn();
    render(<SmartCollectionEditor onSave={onSave} />);
    await userEvent.type(screen.getByTestId("collection-name-input"), "All Files");
    await userEvent.click(screen.getByTestId("collection-save-btn"));
    expect(onSave).toHaveBeenCalledWith("All Files", null, null);
  });

  test("save with BPM range assembles correct queryJson", async () => {
    const onSave = vi.fn();
    render(<SmartCollectionEditor onSave={onSave} />);
    await userEvent.type(screen.getByTestId("collection-name-input"), "Fast");
    await userEvent.type(screen.getByTestId("collection-bpm-min"), "120");
    await userEvent.type(screen.getByTestId("collection-bpm-max"), "140");
    await userEvent.click(screen.getByTestId("collection-save-btn"));
    expect(onSave).toHaveBeenCalledWith(
      "Fast",
      null,
      JSON.stringify({ bpm: { min: 120, max: 140 } }),
    );
  });

  test("does not call onSave when name is empty", async () => {
    const onSave = vi.fn();
    render(<SmartCollectionEditor onSave={onSave} />);
    await userEvent.click(screen.getByTestId("collection-save-btn"));
    expect(onSave).not.toHaveBeenCalled();
  });

  describe("SmartCollectionEditor — duplicate name prevention", () => {
    test("does not call onSave when name already exists (case-insensitive)", async () => {
      const onSave = vi.fn();
      render(<SmartCollectionEditor onSave={onSave} existingNames={["Kicks", "Bass"]} />);
      await userEvent.type(screen.getByTestId("collection-name-input"), "kicks");
      await userEvent.click(screen.getByTestId("collection-save-btn"));
      expect(onSave).not.toHaveBeenCalled();
    });

    test("shows duplicate-name error message", async () => {
      render(<SmartCollectionEditor onSave={() => {}} existingNames={["Kicks"]} />);
      await userEvent.type(screen.getByTestId("collection-name-input"), "Kicks");
      await userEvent.click(screen.getByTestId("collection-save-btn"));
      expect(screen.getByTestId("collection-name-error")).toBeDefined();
    });

    test("unique name calls onSave even when existingNames is provided", async () => {
      const onSave = vi.fn();
      render(<SmartCollectionEditor onSave={onSave} existingNames={["Kicks"]} />);
      await userEvent.type(screen.getByTestId("collection-name-input"), "Snares");
      await userEvent.click(screen.getByTestId("collection-save-btn"));
      expect(onSave).toHaveBeenCalledWith("Snares", null, null);
    });
  });

  test("clears inputs after successful save", async () => {
    const onSave = vi.fn();
    render(<SmartCollectionEditor onSave={onSave} />);
    await userEvent.type(screen.getByTestId("collection-name-input"), "Fast");
    await userEvent.type(screen.getByTestId("collection-bpm-min"), "120");
    await userEvent.click(screen.getByTestId("collection-save-btn"));
    expect((screen.getByTestId("collection-name-input") as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("collection-bpm-min") as HTMLInputElement).value).toBe("");
  });
});
