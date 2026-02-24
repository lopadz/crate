import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
} from "@tanstack/virtual-core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useBrowserStore } from "../stores/browserStore";
import { FileRow } from "./FileRow";
import { SearchBar } from "./SearchBar";
import { SessionFilter, getCompatibleKeys } from "./SessionFilter";

const ROW_HEIGHT = 36;

export function FileList() {
  const activeFolder = useBrowserStore((s) => s.activeFolder);
  const fileList = useBrowserStore((s) => s.fileList);
  const selectedIndex = useBrowserStore((s) => s.selectedIndex);
  const setSelectedIndex = useBrowserStore((s) => s.setSelectedIndex);
  const sessionFilter = useBrowserStore((s) => s.sessionFilter);

  const filteredFiles = useMemo(() => {
    let files = fileList;
    if (sessionFilter.bpm !== null) {
      const bpm = sessionFilter.bpm;
      const tolerance = bpm * 0.06;
      files = files.filter(
        (f) => f.bpm != null && Math.abs(f.bpm - bpm) <= tolerance,
      );
    }
    if (sessionFilter.key !== null) {
      const compatible = getCompatibleKeys(sessionFilter.key);
      files = files.filter((f) => f.key != null && compatible.includes(f.key));
    }
    return files;
  }, [fileList, sessionFilter]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [, rerender] = useState(0);

  const virtualizerRef = useRef<Virtualizer<
    HTMLDivElement,
    HTMLDivElement
  > | null>(null);
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

  useEffect(() => virtualizerRef.current!._didMount(), []);
  useLayoutEffect(() => virtualizerRef.current!._willUpdate());

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
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualItems.map((item) => {
              const file = filteredFiles[item.index];
              const originalIndex = fileList.indexOf(file);
              return (
                <FileRow
                  key={item.key}
                  file={file}
                  isSelected={originalIndex === selectedIndex}
                  style={{
                    position: "absolute",
                    top: item.start,
                    width: "100%",
                    height: item.size,
                  }}
                  onClick={() => setSelectedIndex(originalIndex)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
