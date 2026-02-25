import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { AudioFile } from "../../shared/types";
import { RenamePatternEditor } from "./RenamePatternEditor";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const files: AudioFile[] = [
  {
    path: "/music/kick.wav",
    name: "kick.wav",
    extension: ".wav",
    size: 1000,
    bpm: 128,
    key: "Am",
  },
  {
    path: "/music/snare.wav",
    name: "snare.wav",
    extension: ".wav",
    size: 2000,
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RenamePatternEditor", () => {
  test("renders a text input pre-filled with '{original}'", () => {
    render(<RenamePatternEditor files={files} onCommit={vi.fn()} />);
    const input = screen.getByTestId("rename-pattern-input") as HTMLInputElement;
    expect(input.value).toBe("{original}");
  });

  test("typing a pattern shows a preview table", () => {
    render(<RenamePatternEditor files={files} onCommit={vi.fn()} />);
    // Clear pattern → preview disappears
    fireEvent.change(screen.getByTestId("rename-pattern-input"), { target: { value: "" } });
    expect(screen.queryByTestId("preview-table")).toBeNull();
    // Type a pattern → preview appears
    fireEvent.change(screen.getByTestId("rename-pattern-input"), {
      target: { value: "{original}" },
    });
    expect(screen.queryByTestId("preview-table")).not.toBeNull();
  });

  test("preview table has 'Before' and 'After' column headers", () => {
    render(<RenamePatternEditor files={files} onCommit={vi.fn()} />);
    expect(screen.getByText("Before")).toBeDefined();
    expect(screen.getByText("After")).toBeDefined();
  });

  test("preview table has one row per file", () => {
    render(<RenamePatternEditor files={files} onCommit={vi.fn()} />);
    // getAllByRole('row') includes the header row
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(files.length + 1);
  });

  test("'Before' column shows the current filename with extension", () => {
    render(<RenamePatternEditor files={files} onCommit={vi.fn()} />);
    // With default pattern "{original}", both Before and After show the same name;
    // use getAllByText to handle duplicates and confirm it is present.
    expect(screen.getAllByText("kick.wav").length).toBeGreaterThan(0);
    expect(screen.getAllByText("snare.wav").length).toBeGreaterThan(0);
  });

  test("'After' column shows the token-resolved result with extension preserved", () => {
    render(<RenamePatternEditor files={[files[0]]} onCommit={vi.fn()} />);
    fireEvent.change(screen.getByTestId("rename-pattern-input"), {
      target: { value: "{bpm}_{original}" },
    });
    // files[0]: bpm=128, name="kick.wav", ext=".wav" → "128_kick.wav"
    expect(screen.getByText("128_kick.wav")).toBeDefined();
  });

  test("'Rename' button is disabled when pattern is empty", () => {
    render(<RenamePatternEditor files={files} onCommit={vi.fn()} />);
    fireEvent.change(screen.getByTestId("rename-pattern-input"), { target: { value: "" } });
    expect(screen.getByTestId("rename-button")).toBeDisabled();
  });

  test("'Rename' button is enabled when preview is showing", () => {
    render(<RenamePatternEditor files={files} onCommit={vi.fn()} />);
    // default pattern "{original}" is non-empty → preview shows → button enabled
    expect(screen.getByTestId("rename-button")).not.toBeDisabled();
  });

  test("clicking 'Rename' calls onCommit(pattern, false) when 'Edit originals' is OFF", () => {
    const onCommit = vi.fn();
    render(<RenamePatternEditor files={files} onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId("rename-button"));
    expect(onCommit).toHaveBeenCalledWith("{original}", false);
  });

  test("'Edit originals' toggle is OFF by default", () => {
    render(<RenamePatternEditor files={files} onCommit={vi.fn()} />);
    const toggle = screen.getByTestId("edit-originals-toggle") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
  });

  test("when 'Edit originals' is ON, a destructive warning banner is visible", async () => {
    render(<RenamePatternEditor files={files} onCommit={vi.fn()} />);
    await userEvent.click(screen.getByTestId("edit-originals-toggle"));
    expect(screen.getByTestId("destructive-warning")).toBeDefined();
  });

  test("clicking 'Rename' with 'Edit originals' ON calls onCommit(pattern, true)", async () => {
    const onCommit = vi.fn();
    render(<RenamePatternEditor files={files} onCommit={onCommit} />);
    await userEvent.click(screen.getByTestId("edit-originals-toggle"));
    fireEvent.click(screen.getByTestId("rename-button"));
    expect(onCommit).toHaveBeenCalledWith("{original}", true);
  });
});
