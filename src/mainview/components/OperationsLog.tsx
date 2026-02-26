import type { OperationRecord } from "../stores/operationsStore";

function formatAge(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return diff <= 1 ? "just now" : `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type Props = {
  log: OperationRecord[];
  isUndoing: boolean;
  onUndo: (record: OperationRecord) => void;
};

export function OperationsLog({ log, isUndoing, onUndo }: Props) {
  if (log.length === 0) {
    return (
      <p data-testid="empty-message" className="text-xs text-gray-500 px-2 py-3">
        No operations yet
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {log.map((record) => (
        <li
          key={record.id}
          data-testid="log-entry"
          className="flex items-center justify-between px-2 py-1.5 rounded bg-[#1a1a1a] text-xs text-gray-300"
        >
          <span className="flex gap-2 items-center">
            <span className="capitalize text-gray-200">{record.operation}</span>
            <span data-testid="entry-timestamp" className="text-gray-500">
              {formatAge(record.timestamp)}
            </span>
          </span>
          <button
            type="button"
            data-testid="undo-button"
            disabled={isUndoing}
            onClick={() => onUndo(record)}
            className="px-2 py-0.5 rounded text-xs bg-[#252525] text-indigo-400 hover:bg-indigo-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Undo
          </button>
        </li>
      ))}
    </ul>
  );
}
