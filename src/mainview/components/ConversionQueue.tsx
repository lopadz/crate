export type ConversionItem = {
  fileId: string;
  filename: string;
  percent: number;
  outputPath?: string;
};

type Props = {
  items: ConversionItem[];
  onCancel: () => void;
};

export function ConversionQueue({ items, onCancel }: Props) {
  if (items.length === 0) {
    return <p data-testid="idle-message">Idle</p>;
  }
  return (
    <div>
      {items.map((item) => (
        <div key={item.fileId} data-testid="queue-row">
          <span>
            {item.filename} — {item.percent}%
          </span>
          <div data-testid="progress-bar" style={{ width: `${item.percent}%` }} />
          {item.outputPath != null && <span data-testid="checkmark">✓</span>}
        </div>
      ))}
      <button type="button" data-testid="cancel-button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
