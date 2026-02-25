import { useSettingsStore } from "../stores/settingsStore";

const TOKENS = ["{bpm}", "{key}", "{key_camelot}", "{original}"] as const;

export function DragPatternEditor() {
  const dragPattern = useSettingsStore((s) => s.dragPattern);
  const setDragPattern = useSettingsStore((s) => s.setDragPattern);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="drag-pattern-input" className="text-xs text-gray-400 uppercase tracking-wide">
        Drag rename pattern
      </label>

      <input
        id="drag-pattern-input"
        data-testid="drag-pattern-input"
        type="text"
        value={dragPattern}
        onChange={(e) => setDragPattern(e.target.value)}
        className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
        placeholder="{original}"
      />

      <div className="flex flex-wrap gap-1">
        {TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => setDragPattern(dragPattern + token)}
            className="px-2 py-0.5 rounded text-xs bg-[#252525] text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors"
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}
