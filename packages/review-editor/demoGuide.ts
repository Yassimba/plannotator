/**
 * Demo guide data for development mode.
 *
 * Loaded by useGuideData when jobId === DEMO_GUIDE_ID, so the Guided Review
 * screen renders with realistic content without needing an agent run. Section
 * diffs reference the real file paths from demoData.ts's DEMO_DIFF so the
 * per-section DiffViewers resolve against the actual demo files array instead
 * of hitting the "outdated" chip.
 */

import type { CodeGuideData } from '@plannotator/shared/guide';

export const DEMO_GUIDE_ID = 'demo-guide';

export const DEMO_GUIDE: CodeGuideData = {
  title: 'Typed API client, resilient auth, and a safer Button',
  intent:
    'Rewrites the auth hook against a typed request layer so login/refresh failures surface as real errors instead of silent nulls, and closes a long-standing bug where Button fired onClick while disabled.',
  sections: [
    {
      title: 'Button respects disabled at both the prop and DOM level',
      overview:
        'The click handler now checks `disabled` before calling `onClick`, and the underlying `<button>` also gets the native `disabled` attribute via a new `variant` prop. Previously only the visual style hinted at disabled state; the handler still fired. This closes the gap that let a slow double-click submit a form twice. The handler is wrapped in `useCallback` so existing callsites that pass inline arrow functions don\'t cause extra re-renders.',
      diffs: [
        {
          file: 'src/components/Button.tsx',
          summary: 'Guards `onClick` behind the `disabled` prop and forwards native `disabled` to the DOM element.',
        },
      ],
    },
    {
      title: 'Auth hook rewritten against a typed request client',
      // Exercises section diagrams: every box carries `data-code`, so clicking
      // one reveals that file's card below. Paths match DEMO_DIFF.
      diagrams: [`<svg viewBox="0 0 720 190" role="img" aria-label="useAuth delegates to the typed client, which raises ApiError">
  <g data-code="src/hooks/useAuth.ts" style="cursor:pointer">
    <rect x="8" y="60" width="180" height="66" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
    <text x="98" y="88" text-anchor="middle" fill="currentColor" font-size="14" font-weight="600">useAuth</text>
    <text x="98" y="108" text-anchor="middle" fill="currentColor" font-size="11" opacity="0.7">login · logout · refresh</text>
  </g>
  <path d="M188 93 L262 93" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
  <path d="M262 93 l-8 -4 v8 z" fill="currentColor" opacity="0.6"/>
  <g data-code="src/services/api.ts" style="cursor:pointer">
    <rect x="270" y="60" width="180" height="66" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
    <text x="360" y="88" text-anchor="middle" fill="currentColor" font-size="14" font-weight="600">api.auth.*</text>
    <text x="360" y="108" text-anchor="middle" fill="currentColor" font-size="11" opacity="0.7">typed request client</text>
  </g>
  <path d="M450 93 L524 93" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
  <path d="M524 93 l-8 -4 v8 z" fill="currentColor" opacity="0.6"/>
  <g data-code="src/services/api.ts" style="cursor:pointer">
    <rect x="532" y="60" width="180" height="66" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.85"/>
    <text x="622" y="88" text-anchor="middle" fill="currentColor" font-size="14" font-weight="600">ApiError</text>
    <text x="622" y="108" text-anchor="middle" fill="currentColor" font-size="11" opacity="0.7">status + code</text>
  </g>
  <text x="360" y="168" text-anchor="middle" fill="currentColor" font-size="11" opacity="0.55">a failure now reaches the UI as an error, not a null</text>
</svg>`],
      overview:
        'useAuth used to fake success/failure with untyped fetch calls; it now delegates to `api.auth.*`, a typed client with a proper `ApiError` class carrying status and code. `login`/`logout`/`refresh` are all `useCallback`-wrapped and the hook now tracks `error` in state so the UI can show why a login failed rather than just spinning. This is the change that made the Button fix visible in the first place: a disabled login button that silently still fired was masking failed-login retries.',
      diffs: [
        {
          file: 'src/hooks/useAuth.ts',
          summary: 'Replaces the untyped fetch calls with `api.auth.*` and adds `error` state so failed logins surface in the UI.',
        },
        {
          file: 'src/services/api.ts',
          summary: 'New typed request client with an `ApiError` class carrying HTTP status and error code.',
        },
      ],
    },
    {
      title: 'Formatting-only cleanup, no behavior change',
      overview:
        'settings.ts picked up a repo-wide indentation pass (2-space to 4-space in the config getters) with no logic changes beyond bumping the production pool max from 20 to a still-20 (no-op) — worth a glance only to confirm the diff really is whitespace. Modal.tsx is a new, self-contained portal-based dialog component added opportunistically; nothing in this changeset wires it up yet.',
      diffs: [
        {
          file: 'src/config/settings.ts',
          summary: 'Indentation-only reformat of the config getters; no behavior change.',
        },
        {
          file: 'src/components/Modal.tsx',
          summary: 'New portal-based dialog component; added but not yet wired up anywhere.',
        },
      ],
    },
  ],
  unplacedFiles: ['src/utils/helpers.ts'],
  reviewed: [],
};
