import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  test("renders without crashing", () => {
    render(<App />);
  });

  test("renders sidebar, file list panel, detail panel, and playback bar", () => {
    render(<App />);
    expect(screen.getByTestId("sidebar")).toBeDefined();
    expect(screen.getByTestId("file-list-panel")).toBeDefined();
    expect(screen.getByTestId("detail-panel")).toBeDefined();
    expect(screen.getByTestId("playback-bar")).toBeDefined();
  });
});
