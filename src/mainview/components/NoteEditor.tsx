import { useRpcState } from "../hooks/useRpcState";
import { rpcClient } from "../rpc";

interface NoteEditorProps {
  compositeId: string;
}

export function NoteEditor({ compositeId }: NoteEditorProps) {
  const [content, setContent] = useRpcState(
    () => rpcClient?.request.dbGetNote({ compositeId }).then((note) => note ?? ""),
    [compositeId],
    "",
  );

  const handleBlur = () => {
    rpcClient?.send.dbSetNote({ compositeId, content });
  };

  return (
    <textarea
      data-testid="note-editor"
      value={content}
      onChange={(e) => setContent(e.target.value)}
      onBlur={handleBlur}
      placeholder="Add notes…"
      className="w-full flex-1 resize-none bg-transparent text-xs text-gray-400 placeholder-gray-600 focus:outline-none p-3"
    />
  );
}
