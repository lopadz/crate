import { notesApi } from "../api/notes";
import { useRpcState } from "../hooks/useRpcState";

interface NoteEditorProps {
  compositeId: string;
}

export function NoteEditor({ compositeId }: NoteEditorProps) {
  const [content, setContent] = useRpcState(() => notesApi.getNote(compositeId), [compositeId], "");

  const handleBlur = () => {
    notesApi.setNote(compositeId, content);
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
