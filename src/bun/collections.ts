export interface CollectionFilter {
  bpm?: { min: number; max: number };
  key?: string[];
  tags?: string[];
}

const BASE_SQL = "SELECT path, composite_id, bpm, key FROM files";

export function buildCollectionQuery(queryJson: string): {
  sql: string;
  params: unknown[];
} {
  let filter: CollectionFilter = {};
  if (queryJson && queryJson.trim() !== "") {
    try {
      filter = JSON.parse(queryJson) as CollectionFilter;
    } catch {
      filter = {};
    }
  }

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.bpm != null) {
    conditions.push("bpm BETWEEN ? AND ?");
    params.push(filter.bpm.min, filter.bpm.max);
  }

  if (filter.key != null && filter.key.length > 0) {
    const placeholders = filter.key.map(() => "?").join(", ");
    conditions.push(`key IN (${placeholders})`);
    params.push(...filter.key);
  }

  if (filter.tags != null && filter.tags.length > 0) {
    const tagPlaceholders = filter.tags.map(() => "?").join(", ");
    conditions.push(
      `EXISTS (SELECT 1 FROM file_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.file_id = files.id AND t.name IN (${tagPlaceholders}))`,
    );
    params.push(...filter.tags);
  }

  const sql =
    conditions.length > 0
      ? `${BASE_SQL} WHERE ${conditions.join(" AND ")}`
      : BASE_SQL;

  return { sql, params };
}
