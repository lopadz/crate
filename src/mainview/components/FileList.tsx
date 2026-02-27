import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  Virtualizer,
} from "@tanstack/virtual-core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useBrowserStore } from "../stores/browserStore";
import { FileRow } from "./FileRow";
import { SearchBar } from "./SearchBar";
import { getCompatibleKeys, SessionFilter } from "./SessionFilter";

const ROW_HEIGHT = 36;

export function FileList() {
  const activeFolder = useBrowserStore((s) => s.activeFolder);
  const fileList = useBrowserStore((s) => s.fileList);
  const selectedIndex = useBrowserStore((s) => s.selectedIndex);
  const sessionFilter = useBrowserStore((s) => s.sessionFilter);

  // O(1) lookup from file path → index in fileList. Rebuilt only when fileList changes.
  const fileIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    fileList.forEach((f, i) => {
      map.set(f.path, i);
    });
    return map;
  }, [fileList]);

  const filteredFiles = useMemo(() => {
    let files = fileList;
    if (sessionFilter.bpm !== null) {
      const bpm = sessionFilter.bpm;
      const tolerance = bpm * 0.06;
      files = files.filter((f) => f.bpm != null && Math.abs(f.bpm - bpm) <= tolerance);
    }
    if (sessionFilter.key !== null) {
      const compatible = getCompatibleKeys(sessionFilter.key);
      files = files.filter((f) => f.key != null && compatible.includes(f.key));
    }
    return files;
  }, [fileList, sessionFilter]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [, rerender] = useState(0);

  const virtualizerRef = useRef<Virtualizer<HTMLDivElement, HTMLDivElement> | null>(null);
  if (!virtualizerRef.current) {
    virtualizerRef.current = new Virtualizer({
      count: filteredFiles.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => ROW_HEIGHT,
      scrollToFn: elementScroll,
      observeElementRect,
      observeElementOffset,
      onChange: () => rerender((n) => n + 1),
    });
  }

  virtualizerRef.current.setOptions({
    count: filteredFiles.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    scrollToFn: elementScroll,
    observeElementRect,
    observeElementOffset,
    onChange: () => rerender((n) => n + 1),
  });

  useEffect(() => virtualizerRef.current?._didMount(), []);
  useLayoutEffect(() => virtualizerRef.current?._willUpdate());

  if (!activeFolder) {
    return (
      <div
        data-testid="file-list"
        className="h-full flex items-center justify-center text-gray-600 text-sm"
      >
        Select a folder to browse files
      </div>
    );
  }

  const virtualizer = virtualizerRef.current;
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div data-testid="file-list" className="h-full flex flex-col">
      <SearchBar />
      <SessionFilter />
      {fileList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          No audio files in this folder
        </div>
      ) : (
        <>
          <div
            data-testid="column-header"
            className="flex items-center gap-2 px-3 text-[11px] text-gray-600 border-b border-[#1e1e1e] h-7 shrink-0 select-none"
          >
            <span className="w-2 shrink-0" />
            <span className="flex-1">Name</span>
            <span className="w-10 text-right shrink-0">Type</span>
            <span className="w-12 text-right shrink-0">Dur</span>
            <span className="w-16 text-right shrink-0">Size</span>
            <span className="w-12 text-right shrink-0">BPM</span>
            <span className="w-10 text-right shrink-0">Key</span>
            <span className="w-14 text-right shrink-0">LUFS</span>
            <span className="w-[62px] text-right shrink-0">Rating</span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualItems.map((item) => {
                const file = filteredFiles[item.index];
                const originalIndex = fileIndexMap.get(file.path) ?? -1;
                return (
                  <FileRow
                    key={item.key}
                    file={file}
                    isSelected={originalIndex === selectedIndex}
                    originalIndex={originalIndex}
                    style={{
                      position: "absolute",
                      top: item.start,
                      width: "100%",
                      height: item.size,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
