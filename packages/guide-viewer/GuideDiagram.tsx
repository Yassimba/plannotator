import React, { useEffect, useMemo, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { CODE_BINDING_ATTR, primaryCodeTarget } from '@plannotator/core/diagram-svg';
import type { ParsedCodePath } from '@plannotator/core/code-file';
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
export function codeTargetFromClick(event: React.MouseEvent<HTMLElement>): ParsedCodePath | null {
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
    onRevealFile(target.filePath, target.line);
  };

  // Figures are drawn on diagram-design's paper (light ground, ink text), so in
  // every theme they sit as a plate: a hairline frame in the theme's border,
  // ink set for currentColor figures, and one hover affordance for the zoom.
  const plate =
    'guide-diagram relative overflow-hidden rounded-lg border bg-[#f5f5f5] text-[#2d3142] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_[data-code]]:cursor-pointer [&_[data-code]:hover]:[filter:brightness(0.93)] [&_[data-code]]:transition-[filter] [&_[data-code]]:duration-150';
  const figure = (
    <div
      className={
        zoomed
          ? `${plate} border-border/60 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.55)] [&_svg]:max-h-[calc(100dvh-6rem)] [&_svg]:w-auto [&_svg]:max-w-full`
          : `${plate} group mt-5 cursor-zoom-in border-border/50 transition-colors duration-200 hover:border-primary/50`
      }
      title={zoomed ? undefined : 'Enlarge · click a bound box to open its code'}
      onClick={handleClick}
    >
      <div dangerouslySetInnerHTML={{ __html: clean }} />
      {!zoomed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-md bg-[#2d3142]/85 px-1.5 py-1 font-mono text-[10px] text-[#f5f5f5] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        >
          <Maximize2 size={11} />
          Enlarge
        </span>
      )}
    </div>
  );

  if (!zoomed) return figure;

  return (
    <div
      data-guide-diagram-zoom
      className="fixed inset-0 z-50 flex cursor-zoom-out flex-col items-center justify-center gap-3 bg-background/90 p-8 backdrop-blur-sm"
      onClick={(event) => {
        // The backdrop zooms out; the plate's own handler decides bound vs. canvas.
        if (event.target === event.currentTarget) setZoomed(false);
      }}
    >
      <div className="max-h-full w-full max-w-[1400px]" onClick={(event) => event.stopPropagation()}>
        {figure}
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        Click a bound box to open its code <span className="mx-1.5 text-muted-foreground/40">·</span> Esc or click outside to zoom out
      </p>
    </div>
  );
}
