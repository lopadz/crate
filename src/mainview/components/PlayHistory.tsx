import type { AudioFile } from "../../shared/types";
import { useRpcFetch } from "../hooks/useRpcFetch";
import { rpcClient } from "../rpc";
import { useBrowserStore } from "../stores/browserStore";

export function PlayHistory() {
  const history = useRpcFetch(
    () => rpcClient?.request.dbGetPlayHistory({ limit: 10 }),
    [],
    [] as AudioFile[],
  );
  const setFileList = useBrowserStore((s) => s.setFileList);
  const setSelectedIndex = useBrowserStore((s) => s.setSelectedIndex);

  const handleClick = (index: number) => {
    setFileList(history);
    setSelectedIndex(index);
  };

  return (
    <div data-testid="play-history">
      {history.length === 0 ? (
        <div data-testid="play-history-empty" className="px-4 py-1 text-xs text-gray-600 italic">
          No recent files
        </div>
      ) : (
        history.map((file, i) => (
          <button
            key={file.compositeId ?? file.path}
            type="button"
            className="w-full text-left px-4 py-1 text-xs text-gray-400 hover:bg-[#222] truncate"
            onClick={() => handleClick(i)}
          >
            {file.name}
          </button>
        ))
      )}
    </div>
  );
}
