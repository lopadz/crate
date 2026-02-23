import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaybackBar } from "./PlaybackBar";

describe("PlaybackBar", () => {
  test("renders without crashing", () => {
    render(<PlaybackBar />);
  });

  test("has playback-bar test id", () => {
    render(<PlaybackBar />);
    expect(screen.getByTestId("playback-bar")).toBeDefined();
  });
});
