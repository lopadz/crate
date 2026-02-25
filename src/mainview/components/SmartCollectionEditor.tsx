import { useState } from "react";

interface SmartCollectionEditorProps {
  onSave: (name: string, color: string | null, queryJson: string | null) => void;
  existingNames?: string[];
}

export function SmartCollectionEditor({ onSave, existingNames = [] }: SmartCollectionEditorProps) {
  const [name, setName] = useState("");
  const [bpmMin, setBpmMin] = useState("");
  const [bpmMax, setBpmMax] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const isDuplicate = existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      setNameError("A collection with this name already exists.");
      return;
    }
    setNameError(null);

    const filter: Record<string, unknown> = {};
    const min = Number(bpmMin);
    const max = Number(bpmMax);
    if (bpmMin !== "" && bpmMax !== "") {
      filter.bpm = { min, max };
    }

    const queryJson = Object.keys(filter).length > 0 ? JSON.stringify(filter) : null;
    onSave(trimmed, null, queryJson);
    setName("");
    setBpmMin("");
    setBpmMax("");
  }

  return (
    <div data-testid="smart-collection-editor" className="px-3 py-2 border-t border-[#2a2a2a] mt-1">
      <div className="text-xs text-gray-600 mb-1">New collection</div>
      <input
        data-testid="collection-name-input"
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setNameError(null);
        }}
        placeholder="Name…"
        className="w-full bg-[#1e1e1e] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500 mb-1"
      />
      {nameError && (
        <p data-testid="collection-name-error" className="text-xs text-red-400 mb-1">
          {nameError}
        </p>
      )}
      <div className="flex gap-1 mb-1">
        <input
          data-testid="collection-bpm-min"
          type="number"
          value={bpmMin}
          onChange={(e) => setBpmMin(e.target.value)}
          placeholder="BPM min"
          className="w-1/2 bg-[#1e1e1e] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
        />
        <input
          data-testid="collection-bpm-max"
          type="number"
          value={bpmMax}
          onChange={(e) => setBpmMax(e.target.value)}
          placeholder="BPM max"
          className="w-1/2 bg-[#1e1e1e] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
        />
      </div>
      <button
        data-testid="collection-save-btn"
        type="button"
        onClick={handleSave}
        className="w-full px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded"
      >
        Save
      </button>
    </div>
  );
}
