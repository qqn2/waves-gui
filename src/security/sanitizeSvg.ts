const FORBIDDEN_ELEMENTS = 'script, foreignObject, image, img, iframe, object, embed, a, style';
const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href']);

/**
 * Sanitize WaveDrom output while it is detached from the live document.
 * The preview needs SVG geometry and text only; active content and remote URLs
 * are never required.
 */
export function sanitizeDetachedSvg(root: Element): void {
  root.querySelectorAll(FORBIDDEN_ELEMENTS).forEach((element) => element.remove());

  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (
        name.startsWith('on') ||
        name === 'style' ||
        (URL_ATTRIBUTES.has(name) && !value.startsWith('#'))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}
