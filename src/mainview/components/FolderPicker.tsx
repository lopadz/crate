import { useEffect, useState } from "react";
import { rpcClient } from "../rpc";
import type { AudioFile } from "../../shared/types";
import { basename } from "../utils/path";

interface FolderPickerProps {
  initialPath: string;
  onPin: (path: string) => void;
  onClose: () => void;
}

function parentDir(path: string): string {
  if (path === "/") return "/";
  const stripped = path.replace(/\/$/, "");
  const parent = stripped.substring(0, stripped.lastIndexOf("/"));
  return parent || "/";
}

export function FolderPicker({ initialPath, onPin, onClose }: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [subdirs, setSubdirs] = useState<string[]>([]);
  const [files, setFiles] = useState<AudioFile[]>([]);

  useEffect(() => {
    rpcClient?.request.fsListDirs({ path: currentPath }).then(setSubdirs);
    rpcClient?.request.fsReaddir({ path: currentPath }).then(setFiles);
  }, [currentPath]);

  function handleUp() {
    setCurrentPath(parentDir(currentPath));
  }

  function handleNavigate(path: string) {
    setCurrentPath(path);
  }

  const atRoot = currentPath === "/";

  return (
    <div data-testid="folder-picker" className="flex flex-col h-full bg-[#1a1a1a] text-gray-100">
      <div className="flex items-center gap-1 px-2 py-1 bg-[#222] border-b border-[#333]">
        <button
          data-testid="folder-picker-up"
          onClick={handleUp}
          disabled={atRoot}
          className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-1"
        >
          ↑
        </button>
        <span data-testid="folder-picker-path" className="flex-1 truncate text-xs text-gray-300">
          {currentPath}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {subdirs.map((dir) => (
          <div
            key={dir}
            data-testid="folder-picker-dir"
            className="flex items-center gap-2 px-3 py-1 hover:bg-[#2a2a2a] cursor-pointer text-sm text-gray-200"
            onClick={() => handleNavigate(dir)}
          >
            <span className="text-gray-500 text-xs">▶</span>
            {basename(dir)}
          </div>
        ))}
        {files.map((file) => (
          <div
            key={file.path}
            data-testid="folder-picker-file"
            className="flex items-center gap-2 px-3 py-1 text-sm text-gray-500 select-none"
          >
            <span className="text-xs">♪</span>
            {file.name}
          </div>
        ))}
      </div>

      <div className="flex gap-2 px-2 py-2 border-t border-[#333]">
        <button
          data-testid="folder-picker-pin"
          onClick={() => onPin(currentPath)}
          className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 rounded px-2 py-1"
        >
          Pin {basename(currentPath) || currentPath}
        </button>
        <button
          data-testid="folder-picker-cancel"
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
