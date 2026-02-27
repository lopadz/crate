import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useRpcState } from "./useRpcState";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useRpcState — initial state", () => {
  test("returns [initial, setter] before fetch resolves", () => {
    const fetcher = vi.fn(() => new Promise<string[]>(() => {})); // never resolves
    const { result } = renderHook(() => useRpcState(fetcher, [], []));
    expect(result.current[0]).toEqual([]);
    expect(typeof result.current[1]).toBe("function");
  });

  test("returns initial when fetcher is null", () => {
    const { result } = renderHook(() => useRpcState(null, [], "default"));
    expect(result.current[0]).toBe("default");
  });
});

describe("useRpcState — fetch on mount", () => {
  test("returns the resolved value after the promise resolves", async () => {
    const data = ["a", "b"];
    const fetcher = vi.fn(() => Promise.resolve(data));
    const { result } = renderHook(() => useRpcState(fetcher, [], []));
    await act(async () => {});
    expect(result.current[0]).toBe(data);
  });

  test("does not update state when fetcher returns undefined", async () => {
    const fetcher = vi.fn(() => undefined);
    const { result } = renderHook(() => useRpcState(fetcher, [], "initial"));
    await act(async () => {});
    expect(result.current[0]).toBe("initial");
  });
});

describe("useRpcState — local mutation via setter", () => {
  test("setter updates the state immediately", async () => {
    const fetcher = vi.fn(() => Promise.resolve("server"));
    const { result } = renderHook(() => useRpcState(fetcher, [], ""));
    await act(async () => {});
    expect(result.current[0]).toBe("server");

    act(() => result.current[1]("local edit"));
    expect(result.current[0]).toBe("local edit");
  });

  test("setter can update state before fetch resolves", () => {
    const fetcher = vi.fn(() => new Promise<string>(() => {})); // never resolves
    const { result } = renderHook(() => useRpcState(fetcher, [], ""));
    act(() => result.current[1]("typed before load"));
    expect(result.current[0]).toBe("typed before load");
  });
});

describe("useRpcState — deps change", () => {
  test("re-fetches when deps change, overwriting local mutations", async () => {
    let id = "a";
    const fetcher = vi.fn(() => Promise.resolve(`note-${id}`));
    const { result, rerender } = renderHook(() => useRpcState(fetcher, [id], ""));
    await act(async () => {});
    expect(result.current[0]).toBe("note-a");

    act(() => result.current[1]("user typed something"));
    expect(result.current[0]).toBe("user typed something");

    id = "b";
    rerender();
    await act(async () => {});
    expect(result.current[0]).toBe("note-b");
  });
});

describe("useRpcState — null fetcher reset", () => {
  test("resets to initial when fetcher becomes null, overwriting local state", async () => {
    let fetcher: (() => Promise<string[]> | undefined) | null = () =>
      Promise.resolve(["loaded"]);
    const { result, rerender } = renderHook(() => useRpcState(fetcher, [fetcher], []));
    await act(async () => {});
    expect(result.current[0]).toEqual(["loaded"]);

    act(() => result.current[1](["mutated"]));
    expect(result.current[0]).toEqual(["mutated"]);

    fetcher = null;
    rerender();
    await act(async () => {});
    expect(result.current[0]).toEqual([]);
  });
});
