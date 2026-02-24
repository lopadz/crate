import { useEffect } from "react";
import { useCollectionStore } from "../stores/collectionStore";
import { FolderTree } from "./FolderTree";
import { PlayHistory } from "./PlayHistory";
import { SmartCollectionEditor } from "./SmartCollectionEditor";

export function Sidebar() {
  const {
    collections,
    activeCollectionId,
    loadCollections,
    selectCollection,
    createCollection,
    deleteCollection,
  } = useCollectionStore();

  useEffect(() => {
    void loadCollections();
  }, []);

  return (
    <div
      data-testid="sidebar"
      className="h-full flex flex-col bg-[#161616] border-r border-[#2a2a2a] text-sm text-gray-400 select-none overflow-y-auto"
    >
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
        Folders
      </div>
      <FolderTree />

      <div data-testid="recent-section" className="mt-2">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
          Recent
        </div>
        <PlayHistory />
      </div>

      <div data-testid="collections-section" className="mt-2">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
          Collections
        </div>
        {collections.map((c) => (
          <div key={c.id} className="group flex items-center hover:bg-[#222]">
            <button
              data-testid={`collection-item-${c.id}`}
              type="button"
              className={`flex-1 text-left px-4 py-1 text-xs truncate ${
                activeCollectionId === c.id
                  ? "text-indigo-400"
                  : "text-gray-400"
              }`}
              onClick={() => void selectCollection(c.id)}
            >
              {c.name}
            </button>
            <button
              data-testid={`collection-delete-${c.id}`}
              type="button"
              aria-label="delete collection"
              className="hidden group-hover:block text-gray-600 hover:text-red-400 px-2 text-xs shrink-0"
              onClick={() => void deleteCollection(c.id)}
            >
              ×
            </button>
          </div>
        ))}
        <SmartCollectionEditor
          onSave={(name, color, queryJson) =>
            void createCollection(name, color, queryJson)
          }
          existingNames={collections.map((c) => c.name)}
        />
      </div>
    </div>
  );
}
