import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { BatchOperationPanel } from "./BatchOperationPanel";

describe("BatchOperationPanel", () => {
  test("renders children inside the panel", () => {
    render(
      <BatchOperationPanel title="Rename Files" onClose={vi.fn()}>
        <span data-testid="child">content</span>
      </BatchOperationPanel>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
  });

  test("displays the title prop as a heading", () => {
    render(
      <BatchOperationPanel title="Rename Files" onClose={vi.fn()}>
        <span />
      </BatchOperationPanel>,
    );
    expect(screen.getByText("Rename Files")).toBeDefined();
  });

  test("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <BatchOperationPanel title="Rename Files" onClose={onClose}>
        <span />
      </BatchOperationPanel>,
    );
    await userEvent.click(screen.getByTestId("close-button"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
