import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CodeGuideData, GuideSection } from '@plannotator/core/guide';
import type { DiffFile } from './types';
import { useGuideHost, type GuideFileScrollTarget } from './host';
import { renderInlineMarkdown } from './renderInlineMarkdown';
import { GuideSectionCard } from './GuideSectionCard';
import { GuidePeek } from './GuidePeek';
import { GUIDE_EAGER_MOUNT_MAX_FILES, GuideViewportProvider } from './GuideViewportManager';

interface GuideViewProps {
  guide: CodeGuideData;
  reviewed: boolean[];
  onToggleReviewed: (index: number) => void;
  /** e.g. "Claude" / "Codex" — omitted when the generating job/engine is unknown. */
  engineLabel?: string;
  focusedFile: string | null;
  onFocusFile: (filePath: string) => void;
  /** Launch a fresh guide when a persisted guide no longer matches this branch. */
  onRegenerate?: () => void;
  /** Extra provenance line under the counts (portable exports: repo, PR link, changeset). */
  sourceLine?: React.ReactNode;
  /** Host-provided controls rendered top-right of the header (in-app: the export button). */
  headerActions?: React.ReactNode;
}

export interface ResolvedGuideSections {
  sectionFiles: DiffFile[][];
  unplacedFiles: DiffFile[];
}

/** Resolve guide refs against the current patch while preserving generated
 * order. First placement wins globally; stale refs remain in chapter chips but
 * are omitted from CodeView items. */
export function resolveGuideSectionFiles(guide: CodeGuideData, files: DiffFile[]): ResolvedGuideSections {
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const seen = new Set<string>();
  const sectionFiles = guide.sections.map((section) => {
    const resolved: DiffFile[] = [];
    for (const ref of section.diffs) {
      if (seen.has(ref.file)) continue;
      seen.add(ref.file);
      const file = filesByPath.get(ref.file);
      if (file) resolved.push(file);
    }
    return resolved;
  });

  const unplacedFiles: DiffFile[] = [];
  for (const filePath of guide.unplacedFiles ?? []) {
    if (seen.has(filePath)) continue;
    seen.add(filePath);
    const file = filesByPath.get(filePath);
    if (file) unplacedFiles.push(file);
  }

  return { sectionFiles, unplacedFiles };
}

/**
 * Generated guide with the original vertical chapter/file-card layout. Every
 * lightweight file shell stays in document flow while GuideViewportProvider
 * bounds the mounted one-file Pierre CodeViews across all chapters.
 */
export const GuideView: React.FC<GuideViewProps> = ({
  guide,
  reviewed,
  onToggleReviewed,
  engineLabel,
  focusedFile,
  onFocusFile,
  onRegenerate,
  sourceLine,
  headerActions,
}) => {
  const host = useGuideHost();
  const resolved = useMemo(() => resolveGuideSectionFiles(guide, host.files), [guide, host.files]);
  // Only the guide's own files register shells; in-app the review may hold many more.
  const guideFileCount = resolved.sectionFiles.reduce((n, files) => n + files.length, 0) + resolved.unplacedFiles.length;
  const hasUnplaced = (guide.unplacedFiles?.length ?? 0) > 0;
  const cardTotal = guide.sections.length + (hasUnplaced ? 1 : 0);
  const reviewedCount = reviewed.filter(Boolean).length;
  const effectiveFocusedFile = focusedFile
    ?? resolved.sectionFiles.find((files) => files.length > 0)?.[0]?.path
    ?? resolved.unplacedFiles[0]?.path
    ?? null;

  /**
   * Document mode: a guide with figures is one continuous document (contents
   * rail, prose, figures, chips) with ONE code peek beside it, the way a
   * Review reads. A guide without figures keeps the card layout, where every
   * file's diff sits in flow and the code is the chapter.
   */
  const documentMode = guide.sections.some((section) => (section.diagrams?.length ?? 0) > 0);
  const [peekClosed, setPeekClosed] = useState(false);
  // The line a figure box or prose anchor named; the host's reveal channel is file-level.
  const revealLineRef = useRef<{ path: string; line: number } | null>(null);

  const localRevealTokenRef = useRef(0);
  const [localRevealTarget, setLocalRevealTarget] = useState<{ filePath: string; token: number } | null>(null);
  const externalRevealTarget = host.revealFile
    ? { filePath: host.revealFile.path, token: host.revealFile.token }
    : null;
  const revealTarget = externalRevealTarget ?? localRevealTarget;
  const peekTarget = revealTarget && revealLineRef.current?.path === revealTarget.filePath
    ? { ...revealTarget, line: revealLineRef.current.line }
    : revealTarget;

  useEffect(() => {
    if (!revealTarget) return;
    onFocusFile(revealTarget.filePath);
    setPeekClosed(false);
    // Token identifies a navigation event; callback identity must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealTarget?.filePath, revealTarget?.token]);

  const handleRequestReveal = useCallback(
    (filePath: string, line?: number) => {
      revealLineRef.current = line ? { path: filePath, line } : null;
      onFocusFile(filePath);
      if (host.onRevealFile) {
        host.onRevealFile(filePath);
      } else {
        localRevealTokenRef.current += 1;
        setLocalRevealTarget({ filePath, token: localRevealTokenRef.current });
      }
    },
    [onFocusFile, host.onRevealFile],
  );

  // Search results are global to the review, but an offscreen guide file has no
  // CodeView to receive the active match. Route each match change through the
  // same reveal channel as outline/sidebar jumps so its chapter opens, its shell
  // mounts, and the target viewer becomes active before line navigation runs.
  const activeSearchMatch = host.activeSearchMatch;
  useEffect(() => {
    if (!activeSearchMatch) return;
    handleRequestReveal(activeSearchMatch.filePath);
  }, [activeSearchMatch?.id, activeSearchMatch?.filePath, handleRequestReveal]);

  const unplacedSection = useMemo<GuideSection | null>(
    () =>
      hasUnplaced
        ? {
            title: 'Everything else',
            overview: "Changed files the guide didn't place into a section — shown so nothing is silently left out.",
            diffs: (guide.unplacedFiles ?? []).map((file) => ({ file })),
          }
        : null,
    [guide.unplacedFiles, hasUnplaced],
  );

  return (
    <GuideViewportProvider className="w-full px-3 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8" eager={guideFileCount <= GUIDE_EAGER_MOUNT_MAX_FILES}>
      {/* Header actions sit in a row above the title on narrow screens and float beside it from md up (desktop unchanged). */}
      {headerActions && <div className="mb-3 flex items-center justify-end gap-2 md:float-right md:mb-0 md:ml-6">{headerActions}</div>}
      <div className="max-w-[72ch]">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground [text-wrap:balance]">{guide.title}</h1>
        {guide.intent && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{renderInlineMarkdown(guide.intent)}</p>
        )}
        <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/60">
          <span>
            {guide.sections.length} section{guide.sections.length !== 1 ? 's' : ''}
            {reviewedCount > 0 && ` · ${reviewedCount}/${guide.sections.length} reviewed`}
            {engineLabel && ` · generated by ${engineLabel}`}
          </span>
          {guide.saved && (
            <span
              className="rounded border border-border/50 bg-muted/40 px-1.5 py-px text-[10px] text-muted-foreground"
              title="This guide is persisted and will be available the next time this review opens"
            >
              Saved
            </span>
          )}
        </p>
        {sourceLine && (
          <p className="mt-1.5 font-mono text-[11px] text-muted-foreground/60">{sourceLine}</p>
        )}
        {guide.moved && (
          <p className="mt-1.5 font-mono text-[11px] text-muted-foreground/50">
            Generated on a different version of this branch
            {onRegenerate && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  Regenerate
                </button>
              </>
            )}
          </p>
        )}
      </div>

      {documentMode ? (
        <DocumentLayout
          guide={guide}
          resolved={resolved}
          focusedFile={effectiveFocusedFile}
          peekTarget={peekTarget}
          peekClosed={peekClosed}
          onClosePeek={() => setPeekClosed(true)}
          onActivate={onFocusFile}
        >
          {guide.sections.map((section, index) => (
            <GuideSectionCard
              key={`${section.title}:${index}`}
              section={section}
              files={resolved.sectionFiles[index] ?? []}
              index={index}
              total={cardTotal}
              reviewed={!!reviewed[index]}
              onToggleReviewed={() => onToggleReviewed(index)}
              focusedFile={effectiveFocusedFile}
              revealTarget={revealTarget}
              onActivate={onFocusFile}
              onRequestReveal={handleRequestReveal}
              document
            />
          ))}
          {unplacedSection && (
            <GuideSectionCard
              section={unplacedSection}
              files={resolved.unplacedFiles}
              index={guide.sections.length}
              total={cardTotal}
              showReviewed={false}
              focusedFile={effectiveFocusedFile}
              revealTarget={revealTarget}
              onActivate={onFocusFile}
              onRequestReveal={handleRequestReveal}
              document
            />
          )}
        </DocumentLayout>
      ) : (
      <div className="mt-6 space-y-4">
        {guide.sections.map((section, index) => (
          <GuideSectionCard
            key={`${section.title}:${index}`}
            section={section}
            files={resolved.sectionFiles[index] ?? []}
            index={index}
            total={cardTotal}
            reviewed={!!reviewed[index]}
            onToggleReviewed={() => onToggleReviewed(index)}
            focusedFile={effectiveFocusedFile}
            revealTarget={revealTarget}
            onActivate={onFocusFile}
            onRequestReveal={handleRequestReveal}
          />
        ))}

        {unplacedSection && (
          <GuideSectionCard
            section={unplacedSection}
            files={resolved.unplacedFiles}
            index={guide.sections.length}
            total={cardTotal}
            showReviewed={false}
            focusedFile={effectiveFocusedFile}
            revealTarget={revealTarget}
            onActivate={onFocusFile}
            onRequestReveal={handleRequestReveal}
          />
        )}
      </div>
      )}
    </GuideViewportProvider>
  );
};

/**
 * Contents rail | document | code peek. The rail names every chapter and
 * marks the one whose file is open in the peek; the peek holds the focused
 * file and closes to give the document the width back.
 */
function DocumentLayout({
  guide,
  resolved,
  focusedFile,
  peekTarget,
  peekClosed,
  onClosePeek,
  onActivate,
  children,
}: {
  guide: CodeGuideData;
  resolved: ResolvedGuideSections;
  focusedFile: string | null;
  peekTarget: GuideFileScrollTarget | null;
  peekClosed: boolean;
  onClosePeek: () => void;
  onActivate: (filePath: string) => void;
  children: React.ReactNode;
}) {
  const host = useGuideHost();
  const [peekExpanded, setPeekExpanded] = useState(false);
  const peekFile = !peekClosed && focusedFile ? host.files.find((file) => file.path === focusedFile) : null;
  const peekSummary = peekFile
    ? guide.sections.flatMap((section) => section.diffs).find((ref) => ref.file === peekFile.path)?.summary
    : undefined;
  // ponytail: "current" is the chapter whose file is open, not scroll position; add an observer if readers ask.
  const currentIndex = focusedFile ? resolved.sectionFiles.findIndex((files) => files.some((file) => file.path === focusedFile)) : -1;
  const titles = [...guide.sections.map((section) => section.title), ...(guide.unplacedFiles?.length ? ['Everything else'] : [])];

  // ⇧Z zooms the code panel to the window, Esc leaves it. Skipped while the
  // reader types (a comment, search) so the shortcut never eats a keystroke.
  useEffect(() => {
    if (!peekFile) {
      setPeekExpanded(false);
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (event.key === 'Z' && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setPeekExpanded((value) => !value);
      } else if (event.key === 'Escape') {
        setPeekExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [peekFile]);

  return (
    <div
      className={`mt-6 lg:grid lg:gap-6 ${
        peekFile ? 'lg:grid-cols-[168px_minmax(0,1fr)_minmax(400px,42%)]' : 'lg:grid-cols-[168px_minmax(0,1fr)]'
      }`}
    >
      <nav aria-label="Contents" className="mb-6 lg:sticky lg:top-3 lg:mb-0 lg:self-start">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Contents</p>
        <ol className="space-y-1">
          {titles.map((title, index) => (
            <li key={`${title}:${index}`}>
              <a
                href={`#guide-section-${index}`}
                className={`flex gap-2 rounded px-1.5 py-1 text-[12px] leading-snug transition-colors hover:text-foreground ${
                  index === currentIndex ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                }`}
              >
                <span className="font-mono text-[10px] text-muted-foreground/50">{index + 1}</span>
                <span className="min-w-0">{title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <article className="min-w-0 space-y-8">{children}</article>
      {peekFile && (
        <GuidePeek
          file={peekFile}
          summary={peekSummary}
          revealTarget={peekTarget}
          onActivate={onActivate}
          onClose={onClosePeek}
          expanded={peekExpanded}
          onToggleExpanded={() => setPeekExpanded((value) => !value)}
        />
      )}
    </div>
  );
}
