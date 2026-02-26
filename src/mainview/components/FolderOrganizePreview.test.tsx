import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { MovePreview } from "../../bun/folderOrganizer";
import { FolderOrganizePreview } from "./FolderOrganizePreview";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePreview(overrides?: Partial<MovePreview>): MovePreview {
  return {
    sourcePath: "/lib/kick.wav",
    destPath: "/lib/Drums/kick.wav",
    matched: true,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FolderOrganizePreview", () => {
  test("Execute button is disabled when there are no matched previews", () => {
    const previews = [makePreview({ matched: false })];
    render(<FolderOrganizePreview previews={previews} onExecute={vi.fn()} />);
    const btn = screen.getByTestId("execute-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("Execute button calls onExecute with all previews", async () => {
    const onExecute = vi.fn();
    const previews = [makePreview()];
    render(<FolderOrganizePreview previews={previews} onExecute={onExecute} />);
    await userEvent.click(screen.getByTestId("execute-button"));
    expect(onExecute).toHaveBeenCalledWith(previews);
  });

  test("unmatched entries show 'No match' in destination column", () => {
    render(
      <FolderOrganizePreview
        previews={[makePreview({ sourcePath: "/lib/hat.wav", matched: false })]}
        onExecute={vi.fn()}
      />,
    );
    expect(screen.getByText("No match")).toBeDefined();
  });

  test("unmatched entries have a data-unmatched attribute", () => {
    const previews = [
      makePreview({ matched: true }),
      makePreview({ sourcePath: "/lib/hat.wav", matched: false }),
    ];
    render(<FolderOrganizePreview previews={previews} onExecute={vi.fn()} />);
    const rows = screen.getAllByTestId("preview-row");
    expect(rows[0].dataset.unmatched).toBeUndefined();
    expect(rows[1].dataset.unmatched).toBe("true");
  });

  test("renders one row per preview entry", () => {
    const previews = [
      makePreview({ sourcePath: "/lib/kick.wav" }),
      makePreview({ sourcePath: "/lib/snare.wav" }),
    ];
    render(<FolderOrganizePreview previews={previews} onExecute={vi.fn()} />);
    expect(screen.getAllByTestId("preview-row")).toHaveLength(2);
  });

  test("renders a table with File and Destination columns", () => {
    render(<FolderOrganizePreview previews={[]} onExecute={vi.fn()} />);
    expect(screen.getByTestId("col-file")).toBeDefined();
    expect(screen.getByTestId("col-destination")).toBeDefined();
  });
});
