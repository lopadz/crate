/**
 * Canonical token resolver for filename patterns.
 *
 * Tokens: {original}, {bpm}, {key}, {key_camelot}, {lufs}, {duration},
 *         {format}, {index}, {date}, {collection}
 *
 * Unknown tokens are left as literal text.
 * Null/undefined token values leave the token placeholder as-is.
 */

export type TokenContext = {
  original: string; // filename without extension
  bpm?: number | null;
  key?: string | null;
  keyCamelot?: string | null;
  lufs?: number | null;
  duration?: number | null; // seconds → formatted as "3.2s"
  format?: string | null; // 'wav', 'flac', etc. — lowercased
  index?: number; // 0-based input → "001" output (1-based, 3 digits)
  collection?: string | null;
  date?: string; // YYYY-MM-DD; defaults to today if omitted
};

export function resolveTokens(pattern: string, ctx: TokenContext): string {
  const today = new Date().toISOString().slice(0, 10);
  return pattern
    .replace(/\{original\}/g, ctx.original)
    .replace(/\{bpm\}/g, ctx.bpm != null ? String(Math.round(ctx.bpm)) : "{bpm}")
    .replace(/\{key\}/g, ctx.key ?? "{key}")
    .replace(/\{key_camelot\}/g, ctx.keyCamelot ?? "{key_camelot}")
    .replace(/\{lufs\}/g, ctx.lufs != null ? ctx.lufs.toFixed(1) : "{lufs}")
    .replace(/\{duration\}/g, ctx.duration != null ? `${ctx.duration.toFixed(1)}s` : "{duration}")
    .replace(/\{format\}/g, ctx.format != null ? ctx.format.toLowerCase() : "{format}")
    .replace(/\{index\}/g, ctx.index != null ? String(ctx.index + 1).padStart(3, "0") : "{index}")
    .replace(/\{date\}/g, ctx.date ?? today)
    .replace(/\{collection\}/g, ctx.collection ?? "{collection}");
}
