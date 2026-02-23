import { useEffect, useState } from "react";
import { rpcClient } from "../rpc";
import { useBrowserStore } from "../stores/browserStore";
import { basename } from "../utils/path";
import { FolderPicker } from "./FolderPicker";

interface FolderNode {
  path: string;
  children: string[] | null; // null = not yet loaded
}

export function FolderTree() {
  const [pinnedFolders, setPinnedFolders] = useState<FolderNode[]>([]);
  const [pickerPath, setPickerPath] = useState<string | null>(null);
  const setActiveFolder = useBrowserStore((s) => s.setActiveFolder);

  useEffect(() => {
    rpcClient?.request.dbGetPinnedFolders({}).then((paths) => {
      setPinnedFolders(paths.map((path) => ({ path, children: null })));
    });
  }, []);

  function handleExpand(path: string) {
    rpcClient?.request.fsListDirs({ path }).then((children) => {
      setPinnedFolders((prev) =>
        prev.map((node) => (node.path === path ? { ...node, children } : node)),
      );
    });
  }

  function handleAddFolder() {
    rpcClient?.request.fsGetHomeDir({}).then((home) => setPickerPath(home));
  }

  function handlePin(path: string) {
    rpcClient?.send.dbPinFolder({ path });
    setPinnedFolders((prev) => [...prev, { path, children: null }]);
    setPickerPath(null);
  }

  function handleUnpin(path: string) {
    rpcClient?.send.dbUnpinFolder({ path });
    setPinnedFolders((prev) => prev.filter((n) => n.path !== path));
  }

  return (
    <div data-testid="folder-tree" className="flex flex-col h-full">
      {pickerPath !== null ? (
        <FolderPicker initialPath={pickerPath} onPin={handlePin} onClose={() => setPickerPath(null)} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {pinnedFolders.map((node) => (
            <div key={node.path}>
              <div className="group flex items-center gap-1 px-2 py-1 hover:bg-[#222] cursor-pointer">
                <button
                  aria-label="expand"
                  className="text-gray-500 w-4 shrink-0"
                  onClick={() => handleExpand(node.path)}
                >
                  ▶
                </button>
                <span className="flex-1 truncate" onClick={() => setActiveFolder(node.path)}>
                  {basename(node.path)}
                </span>
                <button
                  aria-label="unpin"
                  className="hidden group-hover:block text-gray-600 hover:text-red-400 w-4 shrink-0 text-xs"
                  onClick={() => handleUnpin(node.path)}
                >
                  ×
                </button>
              </div>
              {node.children &&
                node.children.map((child) => (
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
            data-testid="add-folder-btn"
            className="w-full px-3 py-1.5 text-left text-xs text-gray-600 hover:text-gray-400 hover:bg-[#222]"
            onClick={handleAddFolder}
          >
            + Add folder
          </button>
        </div>
      )}
    </div>
  );
}
