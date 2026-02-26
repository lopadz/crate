import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { ConversionItem } from "./ConversionQueue";
import { ConversionQueue } from "./ConversionQueue";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeItem(fileId: string, percent: number, outputPath?: string): ConversionItem {
  return { fileId, filename: `${fileId}.wav`, percent, outputPath };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ConversionQueue", () => {
  test("shows idle state when items is empty", () => {
    render(<ConversionQueue items={[]} onCancel={vi.fn()} />);
    expect(screen.getByTestId("idle-message")).toBeDefined();
  });

  test("renders one row per item", () => {
    const items = [makeItem("kick", 50), makeItem("snare", 80)];
    render(<ConversionQueue items={items} onCancel={vi.fn()} />);
    expect(screen.getAllByTestId("queue-row")).toHaveLength(2);
  });

  test("each row shows filename and percent", () => {
    render(<ConversionQueue items={[makeItem("kick", 42)]} onCancel={vi.fn()} />);
    const row = screen.getByTestId("queue-row");
    expect(row.textContent).toContain("kick.wav");
    expect(row.textContent).toContain("42%");
  });

  test("each row has a progress bar at the correct percentage", () => {
    render(<ConversionQueue items={[makeItem("kick", 42)]} onCancel={vi.fn()} />);
    const bar = screen.getByTestId("progress-bar") as HTMLElement;
    expect(bar.style.width).toBe("42%");
  });

  test("completed items (with outputPath) show a checkmark", () => {
    const done = makeItem("kick", 100, "/out/kick.wav");
    render(<ConversionQueue items={[done]} onCancel={vi.fn()} />);
    expect(screen.getByTestId("checkmark")).toBeDefined();
  });

  test("Cancel button calls onCancel", async () => {
    const onCancel = vi.fn();
    render(<ConversionQueue items={[makeItem("kick", 50)]} onCancel={onCancel} />);
    await userEvent.click(screen.getByTestId("cancel-button"));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
