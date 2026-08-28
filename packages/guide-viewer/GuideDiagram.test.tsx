import { afterEach, describe, expect, test } from 'bun:test';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GuideDiagram } from './GuideDiagram';

// Sanitization is deliberately not asserted here. happy-dom does not model
// DOMPurify faithfully — it leaves `onclick` in place and drops the `<svg>`
// root — so an assertion either way would be measuring the test DOM, not the
// sanitizer. Verified in a real browser instead: the root and `data-code`
// survive, `onclick` and `<script>` are stripped, `<style>` is kept.

const hasDom = typeof document !== 'undefined';

let root: Root | null = null;
let container: HTMLElement | null = null;

function render(svg: string, onRevealFile: (path: string, line?: number) => void) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<GuideDiagram svg={svg} onRevealFile={onRevealFile} />);
  });
  return container;
}

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
});

const bound = `<svg viewBox="0 0 100 40">
  <g data-code="src/hooks/useAuth.ts, src/services/api.ts"><rect id="box" width="40" height="20"/></g>
</svg>`;

describe.if(hasDom)('GuideDiagram', () => {
  test('a click anywhere inside a bound element reveals its first file', () => {
    const revealed: string[] = [];
    const el = render(bound, (path) => revealed.push(path));

    // The rect, not the bound <g> — a real click lands on the leaf shape.
    act(() => {
      el.querySelector('#box')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(revealed).toEqual(['src/hooks/useAuth.ts']);
  });

  test('a binding with a line range opens the file at its first line', () => {
    const revealed: Array<[string, number | undefined]> = [];
    const el = render(
      '<svg viewBox="0 0 100 40"><g data-code="src/publish.ts:40-66"><rect id="box" width="40" height="20"/></g></svg>',
      (path, line) => revealed.push([path, line]),
    );

    act(() => {
      el.querySelector('#box')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(revealed).toEqual([['src/publish.ts', 40]]);
  });

  test('a click on unbound canvas reveals nothing', () => {
    const revealed: string[] = [];
    const el = render('<svg viewBox="0 0 100 40"><rect id="plain" width="40" height="20"/></svg>', (p) =>
      revealed.push(p),
    );

    act(() => {
      el.querySelector('#plain')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(revealed).toEqual([]);
  });
});

describe.if(hasDom)('GuideDiagram zoom', () => {
  test('unbound canvas toggles the zoomed view; a bound box inside it zooms out and reveals', () => {
    const revealed: string[] = [];
    const el = render(bound, (path) => revealed.push(path));

    act(() => {
      el.querySelector('.guide-diagram')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(el.querySelector('[data-guide-diagram-zoom]')).not.toBeNull();

    act(() => {
      el.querySelector('[data-guide-diagram-zoom] #box')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(el.querySelector('[data-guide-diagram-zoom]')).toBeNull();
    expect(revealed).toEqual(['src/hooks/useAuth.ts']);
  });

  test('Escape leaves the zoomed view', () => {
    const el = render(bound, () => {});
    act(() => {
      el.querySelector('.guide-diagram')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(el.querySelector('[data-guide-diagram-zoom]')).toBeNull();
  });
});
