import { useState } from "react";
import type { Tag } from "../../shared/types";
import { tagsApi } from "../api/tags";
import { TagSearch } from "./TagSearch";

interface TagEditorProps {
  compositeId: string;
  initialTags: Tag[];
  allTags: Tag[];
}

export function TagEditor({ compositeId, initialTags, allTags }: TagEditorProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags);

  function handleRemove(tagId: number) {
    tagsApi.removeFromFile(compositeId, tagId);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  function handleSelect(tag: Tag) {
    tagsApi.addToFile(compositeId, tag.id);
    setTags((prev) => [...prev, tag]);
  }

  async function handleCreate(name: string) {
    const newTag = await tagsApi.create(name);
    if (newTag) {
      tagsApi.addToFile(compositeId, newTag.id);
      setTags((prev) => [...prev, newTag]);
    }
  }

  return (
    <div className="px-3 py-2">
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            data-testid={`tag-chip-${tag.id}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#2a2a2a] text-gray-300"
          >
            {tag.color && (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
            )}
            {tag.name}
            <button
              data-testid={`tag-chip-remove-${tag.id}`}
              type="button"
              className="ml-0.5 text-gray-500 hover:text-gray-200"
              onClick={() => handleRemove(tag.id)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <TagSearch
        allTags={allTags}
        excludeIds={tags.map((t) => t.id)}
        onSelect={handleSelect}
        onCreate={handleCreate}
      />
    </div>
  );
}
