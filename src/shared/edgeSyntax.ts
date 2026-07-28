const UNDULATE_EDGE_PATTERN =
  /^\s*([\p{L}\p{N}_.#]+)\s*([<>#*]?)\s*(-\|-|-\||\|-|-~|~-|[-~])\s*([<>#*]?)\s*([\p{L}\p{N}_.#]+)(?:\s+(.*?))?\s*$/u;

export interface ParsedUndulateEdge {
  from: string;
  connector: string;
  to: string;
  label: string;
}

/** Parse Undulate's whitespace-tolerant NODE PATTERN NODE [TEXT] notation. */
export function parseUndulateEdge(value: string): ParsedUndulateEdge | null {
  const match = value.match(UNDULATE_EDGE_PATTERN);
  if (!match) return null;
  return {
    from: match[1]!,
    connector: `${match[2] ?? ''}${match[3]!}${match[4] ?? ''}`,
    to: match[5]!,
    label: match[6]?.trim() ?? '',
  };
}

/** Convert an Undulate edge to the compact spelling used by the app renderer. */
export function normalizeUndulateEdge(value: string): string | null {
  const parsed = parseUndulateEdge(value);
  if (!parsed) return null;
  const path = `${parsed.from}${parsed.connector}${parsed.to}`;
  return parsed.label ? `${path} ${parsed.label}` : path;
}

export function hasUndulateOnlyEdgeMarker(value: string): boolean {
  const parsed = parseUndulateEdge(value);
  return parsed?.connector.includes('#') === true
    || parsed?.connector.includes('*') === true;
}
