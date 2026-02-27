import { type DependencyList, type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";

/**
 * Server-Seeded Local State hook.
 *
 * Loads initial data from an RPC call, then hands ownership to the caller
 * via the returned setter — allowing local mutations (typing, add, remove)
 * after the initial fetch. Re-fetches (and overwrites local state) whenever
 * deps change. Pass null as fetcher to reset state to initial.
 *
 * Returns [data, setData] — identical to useState, but seeded from RPC.
 */
export function useRpcState<T>(
  fetcher: (() => Promise<T> | undefined) | null,
  deps: DependencyList,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const initialRef = useRef(initial);
  const [data, setData] = useState<T>(initial);

  useEffect(() => {
    if (fetcher === null) {
      setData(initialRef.current);
      return;
    }
    void fetcher()?.then(setData);
    // biome-ignore lint/correctness/useExhaustiveDependencies: caller-controlled deps
  }, deps);

  return [data, setData];
}
