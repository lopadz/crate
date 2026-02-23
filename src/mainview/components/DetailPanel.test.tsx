import { vi, describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("wavesurfer.js", () => ({
  default: { create: vi.fn().mockReturnValue({ on: vi.fn(), load: vi.fn(), destroy: vi.fn(), getDuration: vi.fn() }) },
}));
vi.mock("../services/audioEngine", () => ({ audioEngine: { seek: vi.fn() } }));

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
