const UNDULATE_EDGE_PATTERN =
  /^\s*([\p{L}\p{N}_.#]+)\s*([<>#*]?)\s*(-\|-|-\||\|-|-~|~-|[-~])\s*([<>#*]?)\s*([\p{L}\p{N}_.#]+)(?:\s+(.*?))?\s*$/u;
const UNDULATE_EDGE_NODE_PATTERN = /^[\p{L}\p{N}_.#]+$/u;
const UNDULATE_EDGE_MIDDLES = new Set([
  '-',
  '~',
  '-~',
  '~-',
  '-|',
  '|-',
  '-|-',
]);

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

/**
 * Convert WaveDrom's compact edge notation to Undulate's stricter grammar.
 *
 * Undulate has no equivalent for WaveDrom's `+` tee-ended line or `/`
 * spelling. Both are straight connections, so degrade those decorations to
 * `-` while preserving endpoints, arrowheads, and label text.
 */
export function wavedromEdgeToUndulate(
  value: string,
  interpretWavedromLabelMarker = false,
): string | null {
  if (!interpretWavedromLabelMarker) {
    const normalized = normalizeUndulateEdge(value);
    if (normalized) return normalized;
  }

  const trimmed = value.trim();
  const gap = trimmed.search(/\s/u);
  const path = gap === -1 ? trimmed : trimmed.slice(0, gap);
  const label = gap === -1 ? '' : trimmed.slice(gap + 1).trim();
  if (path.length < 2) return null;

  const from = path[0]!;
  const to = path[path.length - 1]!;
  if (
    !UNDULATE_EDGE_NODE_PATTERN.test(from)
    || !UNDULATE_EDGE_NODE_PATTERN.test(to)
  ) {
    return null;
  }

  let connector = path.slice(1, -1);
  const startArrow = connector.startsWith('<');
  const endArrow = connector.endsWith('>');
  if (startArrow) connector = connector.slice(1);
  if (endArrow) connector = connector.slice(0, -1);

  // WaveDrom uses `#` to adjust label placement. Undulate does not carry that
  // path hint, so retain the dependency and its label with the closest path.
  connector = connector.replaceAll('#', '');
  const middle = UNDULATE_EDGE_MIDDLES.has(connector) ? connector : '-';
  const converted = `${from}${startArrow ? '<' : ''}${middle}${endArrow ? '>' : ''}${to}`;
  return label ? `${converted} ${label}` : converted;
}

export function hasUndulateOnlyEdgeMarker(value: string): boolean {
  const parsed = parseUndulateEdge(value);
  return parsed?.connector.includes('#') === true
    || parsed?.connector.includes('*') === true;
}
