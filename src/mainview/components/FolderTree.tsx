import { foldersApi } from "../api/folders";
import { useRpcState } from "../hooks/useRpcState";
import { useBrowserStore } from "../stores/browserStore";
import { basename } from "../utils/path";

interface FolderNode {
  path: string;
  children: string[] | null; // null = not yet loaded
}

export function FolderTree() {
  const [pinnedFolders, setPinnedFolders] = useRpcState(
    () =>
      foldersApi
        .getPinned()
        ?.then((paths) => paths.map((path) => ({ path, children: null }) as FolderNode)),
    [],
    [] as FolderNode[],
  );
  const activeFolder = useBrowserStore((s) => s.activeFolder);
  const setActiveFolder = useBrowserStore((s) => s.setActiveFolder);

  function handleExpand(path: string) {
    foldersApi.listDirs(path)?.then((children) => {
      setPinnedFolders((prev) =>
        prev.map((node) => (node.path === path ? { ...node, children } : node)),
      );
    });
  }

  async function handleAddFolder() {
    let paths: string[] | undefined;
    try {
      paths = await foldersApi.openDialog();
    } catch (err) {
      console.error("[FolderTree] fsOpenFolderDialog failed:", err);
      return;
    }
    if (!paths?.length) return;
    for (const path of paths) {
      foldersApi.pin(path);
      setPinnedFolders((prev) => [...prev, { path, children: null }]);
    }
    setActiveFolder(paths[0]);
  }

  function handleUnpin(path: string) {
    foldersApi.unpin(path);
    setPinnedFolders((prev) => prev.filter((n) => n.path !== path));
    if (activeFolder === path) setActiveFolder(null);
  }

  return (
    <div data-testid="folder-tree" className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {pinnedFolders.map((node) => (
          <div key={node.path}>
            <div className="group flex items-center gap-1 px-2 py-1 hover:bg-[#222] cursor-pointer">
              <button
                type="button"
                aria-label="expand"
                className="text-gray-500 w-4 shrink-0"
                onClick={() => handleExpand(node.path)}
              >
                ▶
              </button>
              {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: folder label acts as a click target in a desktop app context */}
              <span className="flex-1 truncate" onClick={() => setActiveFolder(node.path)}>
                {basename(node.path)}
              </span>
              <button
                type="button"
                aria-label="unpin"
                className="hidden group-hover:block text-gray-600 hover:text-red-400 w-4 shrink-0 text-xs"
                onClick={() => handleUnpin(node.path)}
              >
                ×
              </button>
            </div>
            {node.children?.map((child) => (
              // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: folder list item acts as a click target in a desktop app context
              <div
                key={child}
                className="pl-6 px-2 py-1 hover:bg-[#222] cursor-pointer"
                onClick={() => setActiveFolder(child)}
              >
                {basename(child)}
              </div>
            ))}
          </div>
        ))}

        <button
          type="button"
          data-testid="add-folder-btn"
          className="w-full px-3 py-1.5 text-left text-xs text-gray-600 hover:text-gray-400 hover:bg-[#222]"
          onClick={handleAddFolder}
        >
          + Add folder
        </button>
      </div>
    </div>
  );
}
