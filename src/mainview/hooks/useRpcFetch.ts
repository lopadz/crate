import type { DependencyList } from "react";
import { useRpcState } from "./useRpcState";

/**
 * Remote Data hook — read-only variant of useRpcState.
 *
 * Use when the server fully owns the state and the UI never mutates it locally.
 * Returns the fetched value directly (no setter exposed).
 *
 * For state that needs local mutations after the initial load (e.g. user edits
 * an input seeded from the server), use useRpcState instead.
 */
export function useRpcFetch<T>(
  fetcher: (() => Promise<T> | undefined) | null,
  deps: DependencyList,
  initial: T,
): T {
  const [data] = useRpcState(fetcher, deps, initial);
  return data;
}
