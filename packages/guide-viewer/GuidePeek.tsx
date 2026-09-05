import React from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import type { DiffFile } from './types';
import type { GuideFileScrollTarget } from './host';
import { GuideFileCard } from './GuideFileCard';

/**
 * The one code panel of a document-mode guide: the file the reader last
 * opened from a figure, a prose anchor, or a file chip, beside the document.
 * It is the same GuideFileCard the card layout uses, so annotations, search
 * and the read-only viewer keep working unchanged.
 */
export function GuidePeek({
  file,
  summary,
  revealTarget,
  onActivate,
  onClose,
  expanded,
  onToggleExpanded,
}: {
  file: DiffFile;
  summary?: string;
  revealTarget: GuideFileScrollTarget | null;
  onActivate: (filePath: string) => void;
  onClose: () => void;
  /** Fills the window so the diff is readable; ⇧Z toggles it, Esc leaves it. */
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  return (
    <aside
      data-guide-peek={file.path}
      data-guide-peek-expanded={expanded ? 'true' : 'false'}
      className={
        expanded
          ? 'fixed inset-3 z-40 flex min-h-0 flex-col rounded-lg border border-border/50 bg-card'
          : 'flex h-[calc(100dvh-64px)] min-h-0 flex-col rounded-lg border border-border/50 bg-card lg:sticky lg:top-3'
      }
    >
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border/40 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground" title={file.path}>
          {file.path}
        </span>
        <button
          type="button"
          onClick={onToggleExpanded}
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
          title={expanded ? 'Zoom out (Esc)' : 'Zoom in (⇧Z)'}
          aria-label={expanded ? 'Zoom out' : 'Zoom in'}
        >
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
          title="Close code"
          aria-label="Close code"
        >
          <X size={13} />
        </button>
      </div>
      <div className="min-h-0 flex-1 p-2">
        <GuideFileCard
          file={file}
          summary={summary}
          focused
          revealTarget={revealTarget}
          onActivate={onActivate}
          fill
        />
      </div>
    </aside>
  );
}
