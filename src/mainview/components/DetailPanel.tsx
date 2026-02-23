export function DetailPanel() {
  return (
    <div
      data-testid="detail-panel"
      className="h-full flex flex-col bg-[#161616] border-l border-[#2a2a2a] text-sm text-gray-400"
    >
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
        Detail
      </div>
      {/* Waveform + tag editor mount here in Commits 10/12 */}
    </div>
  );
}
