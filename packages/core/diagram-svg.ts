/**
 * Diagram code bindings.
 *
 * An element in a rendered SVG figure names the files it stands for:
 *
 *   <g data-code="packages/core/guide.ts:40-66, packages/server/review.ts">
 *
 * Clicking it opens the first file in the guide's code peek, scrolled to the
 * first line of an optional `:from-to` (or `:line`) suffix. The attribute is
 * the whole contract, so any renderer that can emit an attribute produces a
 * binding and the figure stays self-contained. Prose uses the same value in a
 * `[text](code:path:from-to)` link.
 */

/** Attribute naming the files an element stands for. */
export const CODE_BINDING_ATTR = "data-code";

/** One bound location: a changed-file path and, when given, the line to scroll to. */
export interface CodeTarget {
  path: string;
  line?: number;
}

/** Every entry of a binding value with its line, when the author gave one. */
export function parseCodeTargets(value: string | null | undefined): CodeTarget[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => {
      const [path, suffix] = part.trim().split(/[:@]/, 2);
      const line = Number.parseInt(suffix ?? "", 10);
      return { path: path.trim(), ...(line > 0 ? { line } : {}) };
    })
    .filter((target) => target.path);
}

/** The primary target of a binding value, or null when it names nothing. */
export function primaryCodeTarget(value: string | null | undefined): CodeTarget | null {
  return parseCodeTargets(value)[0] ?? null;
}
