const FORBIDDEN_ELEMENTS = 'script, foreignObject, image, img, iframe, object, embed, a';
const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href']);

function hasUnsafeCss(css: string): boolean {
  const withoutLocalFragments = css.replace(
    /url\s*\(\s*(['"]?)#[A-Za-z_][\w:.-]*\1\s*\)/gi,
    '',
  );
  return /@import|@namespace|expression\s*\(|(?:javascript|data|https?):|url\s*\(/i.test(
    withoutLocalFragments,
  );
}

/**
 * Sanitize WaveDrom output while it is detached from the live document.
 * The preview needs SVG geometry and text only; active content and remote URLs
 * are never required.
 */
export function sanitizeDetachedSvg(root: Element): void {
  root.querySelectorAll(FORBIDDEN_ELEMENTS).forEach((element) => element.remove());
  root.querySelectorAll('style').forEach((element) => {
    if (hasUnsafeCss(element.textContent ?? '')) element.remove();
  });

  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (
        name.startsWith('on') ||
        (name === 'style' && hasUnsafeCss(value)) ||
        (URL_ATTRIBUTES.has(name) && !value.startsWith('#'))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}
