import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailPanel } from "./DetailPanel";

describe("DetailPanel", () => {
  test("renders without crashing", () => {
    render(<DetailPanel />);
  });

  test("has detail-panel test id", () => {
    render(<DetailPanel />);
    expect(screen.getByTestId("detail-panel")).toBeDefined();
  });
});
