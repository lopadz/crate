import type { TagColor } from "../../shared/types";

const OPTIONS: { color: TagColor; label: string; bg: string }[] = [
  { color: "green", label: "G", bg: "bg-green-500" },
  { color: "yellow", label: "Y", bg: "bg-yellow-400" },
  { color: "red", label: "R", bg: "bg-red-500" },
  { color: null, label: "×", bg: "bg-gray-600" },
];

interface TagBadgeProps {
  currentColor: TagColor;
  onSelect: (color: TagColor) => void;
}

export function TagBadge({ currentColor, onSelect }: TagBadgeProps) {
  return (
    <div
      data-testid="tag-badge"
      className="flex items-center gap-1 px-2 py-1 bg-[#1e1e1e] border border-[#333] rounded shadow-lg"
    >
      {OPTIONS.map(({ color, label, bg }) => (
        <button
          key={color ?? "none"}
          data-testid={`tag-option-${color ?? "none"}`}
          className={`w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center ${bg} ${
            currentColor === color ? "selected ring-2 ring-white" : "opacity-70 hover:opacity-100"
          }`}
          onClick={() => onSelect(color)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
