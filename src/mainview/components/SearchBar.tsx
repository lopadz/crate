import { useRef, useState } from "react";
import { rpcClient } from "../rpc";
import { useBrowserStore } from "../stores/browserStore";

interface SearchBarProps {
  /** Debounce delay in ms before firing the RPC (default 300). Pass 0 in tests. */
  debounceMs?: number;
}

export function SearchBar({ debounceMs = 300 }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const activeFolder = useBrowserStore((s) => s.activeFolder);
  const setFileList = useBrowserStore((s) => s.setFileList);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (value.trim()) {
        const results = await rpcClient?.request?.dbSearchFiles?.({
          query: value,
        });
        if (results) setFileList(results);
      } else if (activeFolder) {
        const files = await rpcClient?.request?.fsReaddir?.({
          path: activeFolder,
        });
        if (files) setFileList(files);
      }
    }, debounceMs);
  };

  return (
    <div
      data-testid="search-bar"
      className="px-3 py-2 border-b border-[#2a2a2a]"
    >
      <input
        data-testid="search-bar-input"
        type="search"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search files, tags…"
        className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
}
