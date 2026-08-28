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
 * binding and the figure stays self-contained. Prose links carry the same
 * `path:from-to` value.
 */
import { parseCodePath, type ParsedCodePath } from "./code-file";

/** Attribute naming the files an element stands for. */
export const CODE_BINDING_ATTR = "data-code";

/**
 * The primary (first) target of a binding value, parsed with the app's code
 * path grammar; an `@rev` suffix is trimmed. Null when the value names nothing.
 */
export function primaryCodeTarget(value: string | null | undefined): ParsedCodePath | null {
  const first = value?.split(",")[0]?.trim().replace(/@.*$/, "");
  return first ? parseCodePath(first) : null;
}
