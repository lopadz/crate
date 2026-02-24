import { useEffect } from "react";
import { useCollectionStore } from "../stores/collectionStore";
import { FolderTree } from "./FolderTree";
import { SmartCollectionEditor } from "./SmartCollectionEditor";

export function Sidebar() {
  const {
    collections,
    activeCollectionId,
    loadCollections,
    selectCollection,
    createCollection,
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

      <div data-testid="collections-section" className="mt-2">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
          Collections
        </div>
        {collections.map((c) => (
          <button
            key={c.id}
            data-testid={`collection-item-${c.id}`}
            type="button"
            className={`w-full text-left px-4 py-1 text-xs truncate hover:bg-[#222] ${
              activeCollectionId === c.id ? "text-indigo-400" : "text-gray-400"
            }`}
            onClick={() => void selectCollection(c.id)}
          >
            {c.name}
          </button>
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
