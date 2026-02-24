import { useState } from "react";
import type { Tag } from "../../shared/types";

interface TagSearchProps {
  allTags: Tag[];
  excludeIds?: number[];
  onSelect: (tag: Tag) => void;
  onCreate: (name: string) => void;
}

export function TagSearch({
  allTags,
  excludeIds = [],
  onSelect,
  onCreate,
}: TagSearchProps) {
  const [value, setValue] = useState("");

  const trimmed = value.trim();
  const available = allTags.filter((t) => !excludeIds.includes(t.id));
  const filtered =
    trimmed === ""
      ? []
      : available.filter((t) =>
          t.name.toLowerCase().includes(trimmed.toLowerCase()),
        );

  const hasExactMatch = available.some(
    (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const showCreate = trimmed !== "" && !hasExactMatch;
  const isOpen = filtered.length > 0 || showCreate;

  function handleSelect(tag: Tag) {
    onSelect(tag);
    setValue("");
  }

  function handleCreate() {
    onCreate(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setValue("");
    }
  }

  return (
    <div className="relative">
      <input
        data-testid="tag-search-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add tag…"
        className="w-full bg-[#1e1e1e] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
      />
      {isOpen && (
        <div
          data-testid="tag-search-dropdown"
          className="absolute top-full left-0 right-0 mt-1 bg-[#252525] border border-[#333] rounded shadow-lg z-20 max-h-48 overflow-y-auto"
        >
          {filtered.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-[#333] flex items-center gap-2"
              onClick={() => handleSelect(tag)}
            >
              {tag.color && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
              )}
              {tag.name}
            </button>
          ))}
          {showCreate && (
            <button
              data-testid="tag-search-create"
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs text-indigo-400 hover:bg-[#333]"
              onClick={handleCreate}
            >
              Create "{trimmed}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
