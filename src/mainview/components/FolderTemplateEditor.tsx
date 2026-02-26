import type { FolderTemplate } from "../../bun/folderOrganizer";

type Props = {
  template: FolderTemplate;
  onChange: (template: FolderTemplate) => void;
};

export function FolderTemplateEditor({ template, onChange }: Props) {
  return (
    <div>
      <input
        data-testid="template-name-input"
        value={template.name}
        onChange={(e) => onChange({ ...template, name: e.target.value })}
      />
      {template.rules.map((rule, i) => (
        <div key={`${rule.tags.join(",")}-${rule.targetPath}-${i}`} data-testid="rule-row">
          <input
            data-testid="rule-tags-input"
            value={rule.tags.join(",")}
            onChange={(e) => {
              const rules = template.rules.map((r, j) =>
                j === i ? { ...r, tags: e.target.value.split(",").map((t) => t.trim()) } : r,
              );
              onChange({ ...template, rules });
            }}
          />
          <input
            data-testid="rule-target-input"
            value={rule.targetPath}
            onChange={(e) => {
              const rules = template.rules.map((r, j) =>
                j === i ? { ...r, targetPath: e.target.value } : r,
              );
              onChange({ ...template, rules });
            }}
          />
          <button
            type="button"
            data-testid="remove-rule-button"
            onClick={() =>
              onChange({ ...template, rules: template.rules.filter((_, j) => j !== i) })
            }
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        data-testid="add-rule-button"
        onClick={() =>
          onChange({ ...template, rules: [...template.rules, { tags: [], targetPath: "" }] })
        }
      >
        Add rule
      </button>
    </div>
  );
}
