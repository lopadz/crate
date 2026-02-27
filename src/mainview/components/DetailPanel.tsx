import { useEffect, useState } from "react";
import type { Tag } from "../../shared/types";
import { useSelectedFile } from "../hooks/useSelectedFile";
import { rpcClient } from "../rpc";
import { NoteEditor } from "./NoteEditor";
import { TagEditor } from "./TagEditor";
import { Waveform } from "./Waveform";

export function DetailPanel() {
  const selectedFile = useSelectedFile();

  const [fileTags, setFileTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (!selectedFile?.compositeId) {
      setFileTags([]);
      return;
    }
    void rpcClient?.request
      .dbGetFileTags({ compositeId: selectedFile.compositeId })
      .then(setFileTags);
  }, [selectedFile?.compositeId]);

  useEffect(() => {
    void rpcClient?.request.dbGetAllTags({}).then(setAllTags);
  }, []);

  return (
    <div
      data-testid="detail-panel"
      className="h-full flex flex-col bg-[#161616] border-l border-[#2a2a2a] text-sm text-gray-400"
    >
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
        Detail
      </div>
      <Waveform />
      {selectedFile?.compositeId && (
        <>
          <TagEditor
            compositeId={selectedFile.compositeId}
            initialTags={fileTags}
            allTags={allTags}
          />
          <NoteEditor compositeId={selectedFile.compositeId} />
        </>
      )}
    </div>
  );
}
