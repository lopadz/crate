import { vi, describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TagColor } from "../../shared/types";
import { TagBadge } from "./TagBadge";

describe("TagBadge", () => {
  test("renders with tag-badge testid", () => {
    render(<TagBadge currentColor={null} onSelect={() => {}} />);
    expect(screen.getByTestId("tag-badge")).toBeDefined();
  });

  test("renders all four color options", () => {
    render(<TagBadge currentColor={null} onSelect={() => {}} />);
    expect(screen.getByTestId("tag-option-green")).toBeDefined();
    expect(screen.getByTestId("tag-option-yellow")).toBeDefined();
    expect(screen.getByTestId("tag-option-red")).toBeDefined();
    expect(screen.getByTestId("tag-option-none")).toBeDefined();
  });

  test("clicking green calls onSelect('green')", async () => {
    const onSelect = vi.fn();
    render(<TagBadge currentColor={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId("tag-option-green"));
    expect(onSelect).toHaveBeenCalledWith("green");
  });

  test("clicking yellow calls onSelect('yellow')", async () => {
    const onSelect = vi.fn();
    render(<TagBadge currentColor={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId("tag-option-yellow"));
    expect(onSelect).toHaveBeenCalledWith("yellow");
  });

  test("clicking red calls onSelect('red')", async () => {
    const onSelect = vi.fn();
    render(<TagBadge currentColor={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId("tag-option-red"));
    expect(onSelect).toHaveBeenCalledWith("red");
  });

  test("clicking none calls onSelect(null)", async () => {
    const onSelect = vi.fn();
    render(<TagBadge currentColor={"green"} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId("tag-option-none"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  test("active option has selected class", () => {
    render(<TagBadge currentColor={"yellow"} onSelect={() => {}} />);
    expect(screen.getByTestId("tag-option-yellow").className).toContain("selected");
    expect(screen.getByTestId("tag-option-green").className).not.toContain("selected");
  });
});
