import { useRef, useState, useEffect, useLayoutEffect } from "react";
import {
  Virtualizer,
  observeElementRect,
  observeElementOffset,
  elementScroll,
} from "@tanstack/virtual-core";
import { useBrowserStore } from "../stores/browserStore";
import { FileRow } from "./FileRow";

const ROW_HEIGHT = 36;

export function FileList() {
  const activeFolder = useBrowserStore((s) => s.activeFolder);
  const fileList = useBrowserStore((s) => s.fileList);
  const selectedIndex = useBrowserStore((s) => s.selectedIndex);
  const setSelectedIndex = useBrowserStore((s) => s.setSelectedIndex);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [, rerender] = useState(0);

  const virtualizerRef = useRef<Virtualizer<HTMLDivElement, HTMLDivElement>>();
  if (!virtualizerRef.current) {
    virtualizerRef.current = new Virtualizer({
      count: fileList.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => ROW_HEIGHT,
      scrollToFn: elementScroll,
      observeElementRect,
      observeElementOffset,
      onChange: () => rerender((n) => n + 1),
    });
  }

  virtualizerRef.current.setOptions({
    count: fileList.length,
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

  if (fileList.length === 0) {
    return (
      <div
        data-testid="file-list"
        className="h-full flex items-center justify-center text-gray-600 text-sm"
      >
        No audio files in this folder
      </div>
    );
  }

  const virtualizer = virtualizerRef.current;
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      data-testid="file-list"
      ref={scrollRef}
      className="h-full overflow-y-auto"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualItems.map((item) => (
          <FileRow
            key={item.key}
            file={fileList[item.index]}
            isSelected={item.index === selectedIndex}
            style={{ position: "absolute", top: item.start, width: "100%", height: item.size }}
            onClick={() => setSelectedIndex(item.index)}
          />
        ))}
      </div>
    </div>
  );
}
