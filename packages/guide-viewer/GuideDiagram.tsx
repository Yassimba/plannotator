import React, { useEffect, useMemo, useState } from 'react';
import { CODE_BINDING_ATTR, primaryCodeTarget, type CodeTarget } from '@plannotator/core/diagram-svg';
import { sanitizeDiagramSvg } from './sanitizeDiagramSvg';

/**
 * A section's figure, with its elements bound to the files they stand for.
 *
 * The SVG is agent-authored, so it is sanitized here — the render step is the
 * only point every producer passes through (see `sanitizeDiagramSvg`).
 *
 * Clicks are delegated from the container rather than bound per element: the
 * markup is injected as a string, so there are no React nodes to attach
 * handlers to, and a diagram can carry dozens of bound elements.
 */
/**
 * The code target a click landed on, or null. Shared by figures and prose:
 * both carry bindings as `data-code` on injected markup, so both delegate one
 * handler from their container instead of binding per element.
 */
export function codeTargetFromClick(event: React.MouseEvent<HTMLElement>): CodeTarget | null {
  const target = event.target as Element | null;
  const bound = target?.closest?.(`[${CODE_BINDING_ATTR}]`);
  if (!bound) return null;
  return primaryCodeTarget(bound.getAttribute(CODE_BINDING_ATTR));
}

export function GuideDiagram({
  svg,
  onRevealFile,
}: {
  svg: string;
  /** Opens a file in the code peek, at `line` when the binding names one. */
  onRevealFile: (path: string, line?: number) => void;
}) {
  const clean = useMemo(() => sanitizeDiagramSvg(svg), [svg]);
  // Click-to-zoom: unbound canvas toggles a full-window view of the figure;
  // a bound box inside it zooms back out AND opens its code, so the reader's
  // loop is read → zoom → pick a box → land in the diff.
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = codeTargetFromClick(event);
    if (!target) {
      setZoomed((value) => !value);
      return;
    }
    event.preventDefault();
    setZoomed(false);
    onRevealFile(target.path, target.line);
  };

  return (
    <div
      className={`guide-diagram [&_svg]:h-auto [&_svg]:w-full [&_[data-code]]:cursor-pointer ${
        zoomed
          ? 'fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-background/95 p-6 [&_svg]:max-h-full [&_svg]:max-w-full'
          : 'mt-4 cursor-zoom-in'
      }`}
      data-guide-diagram-zoom={zoomed ? '' : undefined}
      title={zoomed ? 'Esc or click to zoom out · click a bound box to open its code' : 'Click to enlarge · click a bound box to open its code'}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
