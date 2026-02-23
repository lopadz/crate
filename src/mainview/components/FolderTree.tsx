import { useEffect, useState } from "react";
import { basename } from "../utils/path";
import { rpcClient } from "../rpc";
import { useBrowserStore } from "../stores/browserStore";

interface FolderNode {
  path: string;
  children: string[] | null; // null = not yet loaded
}

export function FolderTree() {
  const [pinnedFolders, setPinnedFolders] = useState<FolderNode[]>([]);
  const setActiveFolder = useBrowserStore((s) => s.setActiveFolder);

  useEffect(() => {
    rpcClient.request.dbGetPinnedFolders({}).then((paths) => {
      setPinnedFolders(paths.map((path) => ({ path, children: null })));
    });
  }, []);

  function handleExpand(path: string) {
    rpcClient.request.fsListDirs({ path }).then((children) => {
      setPinnedFolders((prev) =>
        prev.map((node) => (node.path === path ? { ...node, children } : node)),
      );
    });
  }

  return (
    <div data-testid="folder-tree" className="flex-1 overflow-y-auto">
      {pinnedFolders.map((node) => (
        <div key={node.path}>
          <div className="flex items-center gap-1 px-2 py-1 hover:bg-[#222] cursor-pointer">
            <button
              aria-label="expand"
              className="text-gray-500 w-4 shrink-0"
              onClick={() => handleExpand(node.path)}
            >
              ▶
            </button>
            <span onClick={() => setActiveFolder(node.path)} className="truncate">
              {basename(node.path)}
            </span>
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
    </div>
  );
}
