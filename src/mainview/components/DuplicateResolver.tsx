import { useState } from "react";
import type { DuplicateGroup } from "../../bun/duplicateFinder";

type Props = {
  groups: DuplicateGroup[];
  onResolve: (keep: string, toDelete: string[]) => void;
  onClose: () => void;
};

export function DuplicateResolver({ groups, onResolve, onClose }: Props) {
  // Map from fingerprint → selected keep path
  const [selections, setSelections] = useState<Map<string, string>>(new Map());

  const allResolved = groups.length > 0 && groups.every((g) => selections.has(g.fingerprint));

  function handleKeep(fingerprint: string, filePath: string) {
    setSelections((prev) => new Map(prev).set(fingerprint, filePath));
  }

  function handleResolveAll() {
    for (const g of groups) {
      const keep = selections.get(g.fingerprint);
      if (!keep) continue;
      onResolve(
        keep,
        g.files.filter((f) => f !== keep),
      );
    }
  }

  return (
    <div>
      {groups.map((g) => (
        <div key={g.fingerprint} data-testid="group-section">
          <span data-testid="reason-label">
            {g.reason === "exact-name" ? "exact copy" : "same content"}
          </span>
          {g.files.map((f) => (
            <div key={f} data-testid="file-row">
              <span>{f}</span>
              <button
                type="button"
                data-testid="keep-button"
                onClick={() => handleKeep(g.fingerprint, f)}
              >
                Keep
              </button>
            </div>
          ))}
        </div>
      ))}
      <button
        type="button"
        data-testid="resolve-all-button"
        disabled={!allResolved}
        onClick={handleResolveAll}
      >
        Resolve All
      </button>
      <button type="button" data-testid="close-button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
