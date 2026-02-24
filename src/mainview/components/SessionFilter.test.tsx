import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { useBrowserStore } from "../stores/browserStore";
import { SessionFilter, getCompatibleKeys } from "./SessionFilter";

beforeEach(() => {
  useBrowserStore.setState({
    ...useBrowserStore.getState(),
    sessionFilter: { bpm: null, key: null },
  });
});

describe("SessionFilter", () => {
  test("renders BPM input", () => {
    render(<SessionFilter />);
    expect(screen.getByTestId("session-filter-bpm")).toBeDefined();
  });

  test("renders key select", () => {
    render(<SessionFilter />);
    expect(screen.getByTestId("session-filter-key")).toBeDefined();
  });

  test("key select shows all 24 musical keys plus empty option", () => {
    render(<SessionFilter />);
    const select = screen.getByTestId(
      "session-filter-key",
    ) as HTMLSelectElement;
    expect(select.options.length).toBe(25); // 24 keys + "Any"
  });

  test("entering a BPM updates sessionFilter.bpm in store", () => {
    render(<SessionFilter />);
    fireEvent.change(screen.getByTestId("session-filter-bpm"), {
      target: { value: "128" },
    });
    expect(useBrowserStore.getState().sessionFilter.bpm).toBe(128);
  });

  test("selecting a key updates sessionFilter.key in store", () => {
    render(<SessionFilter />);
    fireEvent.change(screen.getByTestId("session-filter-key"), {
      target: { value: "Am" },
    });
    expect(useBrowserStore.getState().sessionFilter.key).toBe("Am");
  });

  test("clearing BPM input sets bpm to null", () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      sessionFilter: { bpm: 128, key: null },
    });
    render(<SessionFilter />);
    fireEvent.change(screen.getByTestId("session-filter-bpm"), {
      target: { value: "" },
    });
    expect(useBrowserStore.getState().sessionFilter.bpm).toBeNull();
  });

  test("selecting empty key option sets key to null", () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      sessionFilter: { bpm: null, key: "Am" },
    });
    render(<SessionFilter />);
    fireEvent.change(screen.getByTestId("session-filter-key"), {
      target: { value: "" },
    });
    expect(useBrowserStore.getState().sessionFilter.key).toBeNull();
  });
});

describe("getCompatibleKeys", () => {
  test("Am (8A) returns 6 compatible keys including Dm, Em, C, F, G", () => {
    const keys = getCompatibleKeys("Am");
    expect(keys).toHaveLength(6);
    expect(keys).toContain("Am");
    expect(keys).toContain("Dm");
    expect(keys).toContain("Em");
    expect(keys).toContain("C");
    expect(keys).toContain("F");
    expect(keys).toContain("G");
  });

  test("C (8B) returns 6 compatible keys including Am, Dm, Em, F, G", () => {
    const keys = getCompatibleKeys("C");
    expect(keys).toHaveLength(6);
    expect(keys).toContain("C");
    expect(keys).toContain("Am");
    expect(keys).toContain("Dm");
    expect(keys).toContain("Em");
    expect(keys).toContain("F");
    expect(keys).toContain("G");
  });

  test("unknown key returns array containing just itself", () => {
    expect(getCompatibleKeys("Xyz")).toEqual(["Xyz"]);
  });

  test("wraps correctly: B (1B) includes E (12B) and F# (2B)", () => {
    const keys = getCompatibleKeys("B");
    expect(keys).toContain("B");
    expect(keys).toContain("E");
    expect(keys).toContain("F#");
  });
});
