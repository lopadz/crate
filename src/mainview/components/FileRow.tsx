import { useState } from "react";
import type { AudioFile, TagColor } from "../../shared/types";
import { useDragDrop } from "../hooks/useDragDrop";
import { rpcClient } from "../rpc";
import { useAnalysisStore } from "../stores/analysisStore";
import { useBrowserStore } from "../stores/browserStore";
import { formatDuration, formatSize } from "../utils/format";
import { TagBadge } from "./TagBadge";

function StarRating({
  compositeId,
  rating,
}: {
  compositeId: string;
  rating: number | undefined;
}) {
  const setRating = useBrowserStore((s) => s.setRating);

  const handleStar = (e: React.MouseEvent, value: number) => {
    e.stopPropagation();
    const newValue = rating === value ? 0 : value;
    setRating(compositeId, newValue);
    rpcClient?.send.dbSetRating({ compositeId, value: newValue });
  };

  return (
    <span className="flex gap-0.5 shrink-0">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (rating ?? 0) >= n;
        return (
          <button
            key={n}
            type="button"
            data-testid={`star-${n}`}
            data-filled={String(filled)}
            className={`text-xs leading-none ${filled ? "text-yellow-400" : "text-gray-600"}`}
            onClick={(e) => handleStar(e, n)}
          >
            ★
          </button>
        );
      })}
    </span>
  );
}

const TAG_COLORS: Record<NonNullable<TagColor>, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
};

interface FileRowProps {
  file: AudioFile;
  isSelected: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
}

export function FileRow({ file, isSelected, onClick, style }: FileRowProps) {
  const [showTagPicker, setShowTagPicker] = useState(false);
  const setColorTag = useBrowserStore((s) => s.setColorTag);
  const analysisStatus = useAnalysisStore((s) =>
    file.compositeId ? s.fileStatuses[file.compositeId] : undefined,
  );
  const isScanning = analysisStatus === "queued";
  const { onDragStart } = useDragDrop(file);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setShowTagPicker(true);
  }

  function handleSelectTag(color: TagColor) {
    if (file.compositeId) {
      setColorTag(file.compositeId, color);
      rpcClient?.send.dbSetColorTag({ compositeId: file.compositeId, color });
    }
    setShowTagPicker(false);
  }

  return (
    <div
      data-testid="file-row"
      className={`relative flex items-center gap-2 px-3 text-sm cursor-pointer select-none h-9 ${
        isSelected
          ? "selected bg-indigo-600 text-white"
          : "text-gray-300 hover:bg-[#252525]"
      }`}
      style={style}
      draggable={!isScanning}
      onClick={isScanning ? undefined : onClick}
      onDragStart={isScanning ? undefined : onDragStart}
      onContextMenu={handleContextMenu}
    >
      {file.colorTag ? (
        <span
          data-testid={`color-tag-${file.colorTag}`}
          className={`w-2 h-2 rounded-full shrink-0 ${TAG_COLORS[file.colorTag]}`}
        />
      ) : (
        <span className="w-2 shrink-0" />
      )}

      <span
        data-testid="file-name"
        className={`flex-1 truncate ${isScanning ? "opacity-40" : ""}`}
      >
        {file.name}
      </span>

      {isScanning && (
        <span
          data-testid="scanning-indicator"
          className="text-gray-600 text-xs italic shrink-0"
        >
          scanning…
        </span>
      )}

      {!isScanning && (
        <>
          <span className="text-gray-500 w-10 text-right shrink-0">
            {file.extension}
          </span>

          <span className="text-gray-500 w-12 text-right shrink-0">
            {file.duration != null ? formatDuration(file.duration) : "—"}
          </span>

          <span className="text-gray-500 w-16 text-right shrink-0">
            {formatSize(file.size)}
          </span>

          <span
            data-testid="col-bpm"
            className="text-gray-500 w-12 text-right shrink-0"
          >
            {file.bpm != null ? Math.round(file.bpm) : "—"}
          </span>

          <span
            data-testid="col-key"
            className="text-gray-500 w-10 text-right shrink-0"
          >
            {file.keyCamelot ?? "—"}
          </span>

          <span
            data-testid="col-lufs"
            className="text-gray-500 w-14 text-right shrink-0"
          >
            {file.lufsIntegrated != null
              ? Math.round(file.lufsIntegrated)
              : "—"}
          </span>

          {file.compositeId && (
            <StarRating compositeId={file.compositeId} rating={file.rating} />
          )}
        </>
      )}

      {showTagPicker && (
        <div className="absolute left-2 top-full z-10">
          <TagBadge
            currentColor={file.colorTag ?? null}
            onSelect={handleSelectTag}
          />
        </div>
      )}
    </div>
  );
}
