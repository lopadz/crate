import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { useSettingsStore } from "../stores/settingsStore";
import { DragPatternEditor } from "./DragPatternEditor";

beforeEach(() => {
  useSettingsStore.setState({
    ...useSettingsStore.getState(),
    dragPattern: "{original}",
  });
});

describe("DragPatternEditor", () => {
  test("renders a pattern input", () => {
    render(<DragPatternEditor />);
    expect(screen.getByTestId("drag-pattern-input")).toBeDefined();
  });

  test("input shows the current drag pattern", () => {
    render(<DragPatternEditor />);
    const input = screen.getByTestId("drag-pattern-input") as HTMLInputElement;
    expect(input.value).toBe("{original}");
  });

  test("shows token chip buttons for available tokens", () => {
    render(<DragPatternEditor />);
    expect(screen.getByText("{bpm}")).toBeDefined();
    expect(screen.getByText("{key}")).toBeDefined();
    expect(screen.getByText("{key_camelot}")).toBeDefined();
    expect(screen.getByText("{original}")).toBeDefined();
  });

  test("clicking a token chip appends it to the pattern", async () => {
    useSettingsStore.setState({
      ...useSettingsStore.getState(),
      dragPattern: "",
    });
    render(<DragPatternEditor />);
    await userEvent.click(screen.getByText("{bpm}"));
    expect(useSettingsStore.getState().dragPattern).toBe("{bpm}");
  });

  test("editing the input updates the drag pattern in settingsStore", () => {
    render(<DragPatternEditor />);
    const input = screen.getByTestId("drag-pattern-input");
    fireEvent.change(input, { target: { value: "{bpm}_{key}" } });
    expect(useSettingsStore.getState().dragPattern).toBe("{bpm}_{key}");
  });
});
