const UNDULATE_EDGE_PATTERN =
  /^\s*([\p{L}\p{N}_.#]+)\s*([<>#*]?)\s*(-\|-|-\||\|-|-~|~-|[-~])\s*([<>#*]?)\s*([\p{L}\p{N}_.#]+)(?:\s+(.*?))?\s*$/u;

export interface ParsedUndulateEdge {
  from: string;
  connector: string;
  to: string;
  label: string;
}

export type EdgeEndpointDecoration =
  | 'none'
  | 'arrow'
  | 'square'
  | 'circle';

export function splitEdgeConnector(connector: string): {
  start: EdgeEndpointDecoration;
  middle: string;
  end: EdgeEndpointDecoration;
} {
  const start = connector.startsWith('<')
    ? 'arrow'
    : connector.startsWith('#')
      ? 'square'
      : connector.startsWith('*')
        ? 'circle'
        : 'none';
  const end = connector.endsWith('>')
    ? 'arrow'
    : connector.endsWith('#')
      ? 'square'
      : connector.endsWith('*')
        ? 'circle'
        : 'none';
  const startLength = start === 'none' ? 0 : 1;
  const endLength = end === 'none' ? 0 : 1;
  return {
    start,
    middle: connector.slice(startLength, connector.length - endLength) || '-',
    end,
  };
}

export function withEdgeEndpointDecoration(
  connector: string,
  side: 'start' | 'end',
  decoration: EdgeEndpointDecoration,
): string {
  const parts = splitEdgeConnector(connector);
  parts[side] = decoration;
  const token = (value: EdgeEndpointDecoration, position: 'start' | 'end') =>
    value === 'arrow'
      ? position === 'start' ? '<' : '>'
      : value === 'square'
        ? '#'
        : value === 'circle'
          ? '*'
          : '';
  return `${token(parts.start, 'start')}${parts.middle}${token(parts.end, 'end')}`;
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
  const path = parsed.connector.includes('#') || parsed.connector.includes('*')
    ? `${parsed.from} ${parsed.connector} ${parsed.to}`
    : `${parsed.from}${parsed.connector}${parsed.to}`;
  return parsed.label ? `${path} ${parsed.label}` : path;
}

export function hasUndulateOnlyEdgeMarker(value: string): boolean {
  const parsed = parseUndulateEdge(value);
  return parsed?.connector.includes('#') === true
    || parsed?.connector.includes('*') === true;
}
