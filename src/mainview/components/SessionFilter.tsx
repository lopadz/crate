import { useBrowserStore } from "../stores/browserStore";

// Camelot wheel — maps musical key name to { position 1-12, mode A=minor/B=major }
const CAMELOT: Record<string, { pos: number; mode: "A" | "B" }> = {
  Abm: { pos: 1, mode: "A" },
  B: { pos: 1, mode: "B" },
  Ebm: { pos: 2, mode: "A" },
  "F#": { pos: 2, mode: "B" },
  Bbm: { pos: 3, mode: "A" },
  Db: { pos: 3, mode: "B" },
  Fm: { pos: 4, mode: "A" },
  Ab: { pos: 4, mode: "B" },
  Cm: { pos: 5, mode: "A" },
  Eb: { pos: 5, mode: "B" },
  Gm: { pos: 6, mode: "A" },
  Bb: { pos: 6, mode: "B" },
  Dm: { pos: 7, mode: "A" },
  F: { pos: 7, mode: "B" },
  Am: { pos: 8, mode: "A" },
  C: { pos: 8, mode: "B" },
  Em: { pos: 9, mode: "A" },
  G: { pos: 9, mode: "B" },
  Bm: { pos: 10, mode: "A" },
  D: { pos: 10, mode: "B" },
  "F#m": { pos: 11, mode: "A" },
  A: { pos: 11, mode: "B" },
  "C#m": { pos: 12, mode: "A" },
  E: { pos: 12, mode: "B" },
};

// Reverse map: "8A" → "Am"
const CAMELOT_REVERSE: Record<string, string> = {};
for (const [key, { pos, mode }] of Object.entries(CAMELOT)) {
  CAMELOT_REVERSE[`${pos}${mode}`] = key;
}

// All 24 keys in Camelot order (1A,1B,2A,2B,...,12A,12B)
export const ALL_KEYS: string[] = [];
for (let pos = 1; pos <= 12; pos++) {
  const a = CAMELOT_REVERSE[`${pos}A`];
  const b = CAMELOT_REVERSE[`${pos}B`];
  if (a) ALL_KEYS.push(a);
  if (b) ALL_KEYS.push(b);
}

/**
 * Returns the 6 Camelot-compatible keys for a given key:
 * the key itself plus adjacent positions (±1) in both modes.
 * Returns [key] for unknown inputs.
 */
export function getCompatibleKeys(key: string): string[] {
  const entry = CAMELOT[key];
  if (!entry) return [key];
  const { pos } = entry;
  const prev = ((pos - 2 + 12) % 12) + 1;
  const next = (pos % 12) + 1;
  const result: string[] = [];
  for (const p of [prev, pos, next]) {
    const a = CAMELOT_REVERSE[`${p}A`];
    const b = CAMELOT_REVERSE[`${p}B`];
    if (a) result.push(a);
    if (b) result.push(b);
  }
  return result;
}

export function SessionFilter() {
  const sessionFilter = useBrowserStore((s) => s.sessionFilter);
  const setSessionFilter = useBrowserStore((s) => s.setSessionFilter);

  return (
    <div
      data-testid="session-filter"
      className="flex items-center gap-3 px-3 py-1.5 border-b border-[#2a2a2a] bg-[#161616]"
    >
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500 uppercase tracking-wide">
          BPM
        </label>
        <input
          data-testid="session-filter-bpm"
          type="number"
          min={20}
          max={300}
          value={sessionFilter.bpm ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            setSessionFilter({
              ...sessionFilter,
              bpm: val === "" ? null : Number(val),
            });
          }}
          className="w-16 bg-[#111] border border-[#333] rounded px-2 py-0.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
          placeholder="128"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500 uppercase tracking-wide">
          Key
        </label>
        <select
          data-testid="session-filter-key"
          value={sessionFilter.key ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            setSessionFilter({
              ...sessionFilter,
              key: val === "" ? null : val,
            });
          }}
          className="bg-[#111] border border-[#333] rounded px-2 py-0.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">Any</option>
          {ALL_KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
