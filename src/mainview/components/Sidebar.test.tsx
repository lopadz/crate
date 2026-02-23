import { vi, describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../rpc", () => ({
  rpcClient: {
    request: { dbGetPinnedFolders: vi.fn().mockResolvedValue([]) },
    send: {},
  },
}));

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
