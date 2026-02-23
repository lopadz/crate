import type { AudioFile, TagColor } from "../../shared/types";
import { formatSize, formatDuration } from "../utils/format";

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
  return (
    <div
      data-testid="file-row"
      className={`flex items-center gap-2 px-3 text-sm cursor-pointer select-none h-9 ${
        isSelected ? "selected bg-indigo-600 text-white" : "text-gray-300 hover:bg-[#252525]"
      }`}
      style={style}
      onClick={onClick}
    >
      {file.colorTag ? (
        <span
          data-testid={`color-tag-${file.colorTag}`}
          className={`w-2 h-2 rounded-full shrink-0 ${TAG_COLORS[file.colorTag]}`}
        />
      ) : (
        <span className="w-2 shrink-0" />
      )}

      <span className="flex-1 truncate">{file.name}</span>

      <span className="text-gray-500 w-10 text-right shrink-0">{file.extension}</span>

      <span className="text-gray-500 w-12 text-right shrink-0">
        {file.duration != null ? formatDuration(file.duration) : "—"}
      </span>

      <span className="text-gray-500 w-16 text-right shrink-0">{formatSize(file.size)}</span>
    </div>
  );
}
