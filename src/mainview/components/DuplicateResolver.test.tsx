import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { DuplicateGroup } from "../../bun/duplicateFinder";
import { DuplicateResolver } from "./DuplicateResolver";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeGroup(id: number, reason: DuplicateGroup["reason"] = "exact-name"): DuplicateGroup {
  return {
    fingerprint: `fp-${id}`,
    files: [`/a/${id}.wav`, `/b/${id}.wav`],
    reason,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DuplicateResolver", () => {
  test("renders one group section per groups entry", () => {
    const groups = [makeGroup(1), makeGroup(2)];
    render(<DuplicateResolver groups={groups} onResolve={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByTestId("group-section")).toHaveLength(2);
  });

  test("each group lists all file paths", () => {
    render(<DuplicateResolver groups={[makeGroup(1)]} onResolve={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByTestId("file-row")).toHaveLength(2);
    expect(screen.getByText("/a/1.wav")).toBeDefined();
    expect(screen.getByText("/b/1.wav")).toBeDefined();
  });

  test("each file row has a Keep button", () => {
    render(<DuplicateResolver groups={[makeGroup(1)]} onResolve={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByTestId("keep-button")).toHaveLength(2);
  });

  test("Resolve All button is disabled until every group has a selection", async () => {
    const groups = [makeGroup(1), makeGroup(2)];
    render(<DuplicateResolver groups={groups} onResolve={vi.fn()} onClose={vi.fn()} />);
    const btn = screen.getByTestId("resolve-all-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // Select keep for group 1 only — still disabled
    await userEvent.click(screen.getAllByTestId("keep-button")[0]);
    expect(btn.disabled).toBe(true);
    // Select keep for group 2 — now enabled
    await userEvent.click(screen.getAllByTestId("keep-button")[2]);
    expect(btn.disabled).toBe(false);
  });

  test("Resolve All calls onResolve(keep, toDelete) for each group", async () => {
    const onResolve = vi.fn();
    const group = makeGroup(1);
    render(<DuplicateResolver groups={[group]} onResolve={onResolve} onClose={vi.fn()} />);
    await userEvent.click(screen.getAllByTestId("keep-button")[0]); // keep /a/1.wav
    await userEvent.click(screen.getByTestId("resolve-all-button"));
    expect(onResolve).toHaveBeenCalledWith("/a/1.wav", ["/b/1.wav"]);
  });

  test("shows 'exact copy' label for exact-name reason", () => {
    render(
      <DuplicateResolver
        groups={[makeGroup(1, "exact-name")]}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("reason-label").textContent).toBe("exact copy");
  });

  test("shows 'same content' label for content reason", () => {
    render(
      <DuplicateResolver
        groups={[makeGroup(1, "content")]}
        onResolve={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("reason-label").textContent).toBe("same content");
  });

  test("Close button calls onClose", async () => {
    const onClose = vi.fn();
    render(<DuplicateResolver groups={[makeGroup(1)]} onResolve={vi.fn()} onClose={onClose} />);
    await userEvent.click(screen.getByTestId("close-button"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
