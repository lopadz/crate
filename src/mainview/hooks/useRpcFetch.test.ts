import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useRpcFetch } from "./useRpcFetch";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useRpcFetch — initial state", () => {
  test("returns the initial value before the fetch resolves", () => {
    const fetcher = vi.fn(() => new Promise<string[]>(() => {})); // never resolves
    const { result } = renderHook(() => useRpcFetch(fetcher, [], []));
    expect(result.current).toEqual([]);
  });

  test("returns the initial value when fetcher is null", () => {
    const { result } = renderHook(() => useRpcFetch(null, [], "default"));
    expect(result.current).toBe("default");
  });
});

describe("useRpcFetch — fetch on mount", () => {
  test("returns the resolved value after the promise resolves", async () => {
    const data = ["a", "b"];
    const fetcher = vi.fn(() => Promise.resolve(data));
    const { result } = renderHook(() => useRpcFetch(fetcher, [], []));
    await act(async () => {});
    expect(result.current).toBe(data);
  });

  test("calls the fetcher exactly once on mount", async () => {
    const fetcher = vi.fn(() => Promise.resolve(42));
    renderHook(() => useRpcFetch(fetcher, [], 0));
    await act(async () => {});
    expect(fetcher).toHaveBeenCalledOnce();
  });

  test("does not update state when fetcher returns undefined (rpcClient absent)", async () => {
    const fetcher = vi.fn(() => undefined);
    const { result } = renderHook(() => useRpcFetch(fetcher, [], "initial"));
    await act(async () => {});
    expect(result.current).toBe("initial");
  });
});

describe("useRpcFetch — deps change", () => {
  test("re-fetches when deps change", async () => {
    let id = "a";
    const fetcher = vi.fn(() => Promise.resolve(`result-${id}`));
    const { result, rerender } = renderHook(() => useRpcFetch(fetcher, [id], ""));
    await act(async () => {});
    expect(result.current).toBe("result-a");

    id = "b";
    rerender();
    await act(async () => {});
    expect(result.current).toBe("result-b");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("useRpcFetch — null fetcher (conditional reset)", () => {
  test("resets to initial when fetcher transitions from a function to null", async () => {
    let fetcher: (() => Promise<string[]> | undefined) | null = () => Promise.resolve(["x"]);
    const { result, rerender } = renderHook(() => useRpcFetch(fetcher, [fetcher], []));
    await act(async () => {});
    expect(result.current).toEqual(["x"]);

    fetcher = null;
    rerender();
    await act(async () => {});
    expect(result.current).toEqual([]);
  });

  test("stays at initial when mounted with null from the start", async () => {
    const { result } = renderHook(() => useRpcFetch(null, [], [] as string[]));
    await act(async () => {});
    expect(result.current).toEqual([]);
  });
});
