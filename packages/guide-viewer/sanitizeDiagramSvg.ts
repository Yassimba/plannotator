import DOMPurify from 'dompurify';
import { CODE_BINDING_ATTR } from '@plannotator/core/diagram-svg';

/**
 * The one place agent-authored SVG is made safe to inject.
 *
 * Sanitizing at render rather than at authoring time is deliberate: a guide
 * reaches a viewer through several producers (the in-app job, the authored CLI
 * path, a portable export, a direct upload to a share host), and only the
 * render step is common to all of them. A share host serves other people's
 * guides from one origin, so a sanitizer any producer can bypass is not one.
 *
 * It lives here rather than in `@plannotator/core` because core is
 * dependency-free by design and this needs DOMPurify.
 *
 * The binding attribute is added back explicitly: it is inert data, and the
 * click handler re-parses it rather than trusting it as markup.
 */
export function sanitizeDiagramSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_ATTR: [CODE_BINDING_ATTR],
    // Diagram figures carry their own presentation; without inline styles and
    // the <style> block they render as unstyled black-on-white shapes.
    ADD_TAGS: ['style'],
    FORBID_TAGS: ['foreignObject'],
  });
}
