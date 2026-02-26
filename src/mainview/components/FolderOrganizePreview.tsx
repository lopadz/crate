import type { MovePreview } from "../../bun/folderOrganizer";

type Props = {
  previews: MovePreview[];
  onExecute: (previews: MovePreview[]) => void;
};

export function FolderOrganizePreview({ previews, onExecute }: Props) {
  const hasMatched = previews.some((p) => p.matched);

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th data-testid="col-file">File</th>
            <th data-testid="col-destination">Destination</th>
          </tr>
        </thead>
        <tbody>
          {previews.map((p) => (
            <tr
              key={p.sourcePath}
              data-testid="preview-row"
              data-unmatched={!p.matched ? "true" : undefined}
            >
              <td>{p.sourcePath}</td>
              <td>{p.matched ? p.destPath : "No match"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        data-testid="execute-button"
        disabled={!hasMatched}
        onClick={() => onExecute(previews)}
      >
        Execute
      </button>
    </div>
  );
}
