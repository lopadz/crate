import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  test("renders without crashing", () => {
    render(<Sidebar />);
  });

  test("has sidebar test id", () => {
    render(<Sidebar />);
    expect(screen.getByTestId("sidebar")).toBeDefined();
  });
});
