import type { Tag } from "../../shared/types";
import { tagsApi } from "../api/tags";
import { useRpcFetch } from "../hooks/useRpcFetch";
import { useSelectedFile } from "../hooks/useSelectedFile";
import { NoteEditor } from "./NoteEditor";
import { TagEditor } from "./TagEditor";
import { Waveform } from "./Waveform";

export function DetailPanel() {
  const selectedFile = useSelectedFile();
  const compositeId = selectedFile?.compositeId;

  const allTags = useRpcFetch(() => tagsApi.getAll(), [], [] as Tag[]);

  const fileTags = useRpcFetch(
    compositeId ? () => tagsApi.getForFile(compositeId) : null,
    [compositeId],
    [] as Tag[],
  );

  return (
    <div
      data-testid="detail-panel"
      className="h-full flex flex-col bg-[#161616] border-l border-[#2a2a2a] text-sm text-gray-400"
    >
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
        Detail
      </div>
      <Waveform />
      {compositeId && (
        <>
          <TagEditor compositeId={compositeId} initialTags={fileTags} allTags={allTags} />
          <NoteEditor compositeId={compositeId} />
        </>
      )}
    </div>
  );
}
