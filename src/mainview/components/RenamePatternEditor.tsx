import { useState } from "react";
import { resolveTokens } from "../../bun/tokenRenamer";
import type { AudioFile } from "../../shared/types";

type Props = {
  files: AudioFile[];
  onCommit: (pattern: string, destructive: boolean) => void;
};

export function RenamePatternEditor({ files, onCommit }: Props) {
  const [pattern, setPattern] = useState("{original}");
  const [editOriginals, setEditOriginals] = useState(false);

  const showPreview = pattern.trim().length > 0 && files.length > 0;

  function resolveFileName(file: AudioFile, idx: number): string {
    const base = file.name.slice(0, file.name.length - file.extension.length);
    const resolved = resolveTokens(pattern, {
      original: base,
      bpm: file.bpm,
      key: file.key,
      keyCamelot: file.keyCamelot,
      lufs: file.lufsIntegrated,
      duration: file.duration,
      format: file.format ?? file.extension.slice(1),
      index: idx,
    });
    return resolved + file.extension;
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        data-testid="rename-pattern-input"
        type="text"
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
        placeholder="{original}"
      />

      {showPreview && (
        <table data-testid="preview-table" className="w-full text-xs text-gray-300">
          <thead>
            <tr className="text-gray-500 border-b border-[#333]">
              <th className="text-left py-1 pr-4">Before</th>
              <th className="text-left py-1">After</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file, idx) => (
              <tr key={file.path} className="border-b border-[#222]">
                <td className="py-1 pr-4 text-gray-400">{file.name}</td>
                <td className="py-1 text-gray-200">{resolveFileName(file, idx)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
        <input
          type="checkbox"
          data-testid="edit-originals-toggle"
          checked={editOriginals}
          onChange={(e) => setEditOriginals(e.target.checked)}
          className="accent-indigo-500"
        />
        Edit originals
      </label>

      {editOriginals && (
        <div
          data-testid="destructive-warning"
          className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-700 rounded px-3 py-2"
        >
          Warning: this will rename the original files on disk and cannot be undone automatically.
        </div>
      )}

      <button
        type="button"
        data-testid="rename-button"
        disabled={!showPreview}
        onClick={() => onCommit(pattern, editOriginals)}
        className="px-4 py-1.5 rounded text-sm bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Rename
      </button>
    </div>
  );
}
