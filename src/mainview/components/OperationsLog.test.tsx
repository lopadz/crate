import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { OperationRecord } from "../stores/operationsStore";
import { OperationsLog } from "./OperationsLog";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRecord(id: number, operation = "rename", ageMs = 0): OperationRecord {
  return {
    id,
    operation,
    files: [{ originalPath: `/src/${id}.wav`, newPath: `/dest/${id}.wav` }],
    timestamp: Date.now() - ageMs,
    rolledBackAt: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("OperationsLog", () => {
  test("shows 'No operations yet' when log is empty", () => {
    render(<OperationsLog log={[]} isUndoing={false} onUndo={vi.fn()} />);
    expect(screen.getByTestId("empty-message").textContent).toBe("No operations yet");
  });

  test("renders one row per log entry", () => {
    const log = [makeRecord(1), makeRecord(2)];
    render(<OperationsLog log={log} isUndoing={false} onUndo={vi.fn()} />);
    expect(screen.getAllByTestId("log-entry").length).toBe(2);
  });

  test("each row displays the operation type", () => {
    const log = [makeRecord(1, "copy"), makeRecord(2, "rename")];
    render(<OperationsLog log={log} isUndoing={false} onUndo={vi.fn()} />);
    expect(screen.getByText("copy")).toBeDefined();
    expect(screen.getByText("rename")).toBeDefined();
  });

  test("each row displays a readable timestamp containing 'ago'", () => {
    const log = [makeRecord(1, "rename", 2 * 60 * 1000)]; // 2 min ago
    render(<OperationsLog log={log} isUndoing={false} onUndo={vi.fn()} />);
    const timestamps = screen.getAllByTestId("entry-timestamp");
    expect(timestamps[0].textContent).toMatch(/ago|just now/);
  });

  test("each row has an 'Undo' button", () => {
    const log = [makeRecord(1), makeRecord(2)];
    render(<OperationsLog log={log} isUndoing={false} onUndo={vi.fn()} />);
    expect(screen.getAllByTestId("undo-button").length).toBe(2);
  });

  test("clicking 'Undo' calls onUndo with the correct record", async () => {
    const onUndo = vi.fn();
    const record = makeRecord(42, "rename");
    render(<OperationsLog log={[record]} isUndoing={false} onUndo={onUndo} />);
    await userEvent.click(screen.getByTestId("undo-button"));
    expect(onUndo).toHaveBeenCalledWith(record);
  });

  test("when isUndoing is true, all Undo buttons are disabled", () => {
    const log = [makeRecord(1), makeRecord(2)];
    render(<OperationsLog log={log} isUndoing={true} onUndo={vi.fn()} />);
    const buttons = screen.getAllByTestId("undo-button") as HTMLButtonElement[];
    for (const btn of buttons) {
      expect(btn.disabled).toBe(true);
    }
  });

  test("entries render in the order they appear in the log prop (index 0 first)", () => {
    const log = [makeRecord(1, "copy"), makeRecord(2, "rename")];
    render(<OperationsLog log={log} isUndoing={false} onUndo={vi.fn()} />);
    const entries = screen.getAllByTestId("log-entry");
    expect(entries[0].textContent).toContain("copy");
    expect(entries[1].textContent).toContain("rename");
  });
});
