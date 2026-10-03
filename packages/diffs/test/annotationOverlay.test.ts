// NEUVE FORK: tests for the overlay annotation layer (NOTICE.md).
import { afterAll, describe, expect, test } from 'bun:test';

import { disposeHighlighter, FileDiff, parseDiffFromFile } from '../src';
import {
  getOverlayBodySlotName,
  getOverlayPinSlotName,
} from '../src/managers/AnnotationOverlayManager';
import type { DiffLineAnnotation } from '../src/types';
import { installDom } from './domHarness';

afterAll(async () => {
  await disposeHighlighter();
});

const ROW_HEIGHT = 20;
const ITEM_HEIGHT = 22;

const lines = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`);
const oldFile = { name: 'overlay.ts', contents: `${lines.join('\n')}\n` };
const newFile = {
  name: 'overlay.ts',
  contents: `${lines
    .map((line, index) =>
      index === 19 ? 'changed 20' : index === 20 ? 'changed 21' : line
    )
    .join('\n')}\n`,
};

// jsdom performs no layout. Give every row in a content column a fixed
// height stacked in DOM order (separators included, so expanding a hunk moves
// the rows below it), overlay items a fixed height, and everything else zero.
function rowTopOf(element: Element): number {
  const column = element.parentElement;
  if (column == null) return 0;
  return Array.prototype.indexOf.call(column.children, element) * ROW_HEIGHT;
}

function installGeometry(): () => void {
  const proto = HTMLElement.prototype;
  const originalRect = proto.getBoundingClientRect;
  const originalHeight = Object.getOwnPropertyDescriptor(proto, 'offsetHeight');
  proto.getBoundingClientRect = function (this: HTMLElement) {
    const top = this.hasAttribute('data-line') ? rowTopOf(this) : 0;
    return {
      top,
      bottom: top + ROW_HEIGHT,
      left: 0,
      right: 0,
      width: 0,
      height: ROW_HEIGHT,
      x: 0,
      y: top,
      toJSON() {},
    } as DOMRect;
  };
  Object.defineProperty(proto, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-overlay-item') ? ITEM_HEIGHT : 0;
    },
  });
  return () => {
    proto.getBoundingClientRect = originalRect;
    if (originalHeight != null) {
      Object.defineProperty(proto, 'offsetHeight', originalHeight);
    }
  };
}

async function waitForCode(container: HTMLElement): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (container.shadowRoot?.querySelector('code') != null) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for FileDiff render');
}

function setup(annotations: DiffLineAnnotation<string>[]) {
  const dom = installDom();
  const restoreGeometry = installGeometry();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const instance = new FileDiff<string>({
    diffStyle: 'unified',
    disableFileHeader: true,
    disableErrorHandling: true,
    annotationLayout: 'overlay',
    expansionLineCount: 5,
  });
  const fileDiff = parseDiffFromFile(oldFile, newFile);
  instance.render({ fileContainer: container, fileDiff, lineAnnotations: annotations });
  return {
    container,
    instance,
    fileDiff,
    shadow: () => container.shadowRoot!,
    cleanup() {
      instance.cleanUp();
      restoreGeometry();
      dom.cleanup();
    },
  };
}

const ANNOTATIONS: DiffLineAnnotation<string>[] = [
  { id: 'doc', side: 'additions', lineNumber: 20, metadata: 'doc' },
  { id: 'graph', side: 'additions', lineNumber: 21, metadata: 'graph' },
  { id: 'note', side: 'additions', lineNumber: 21, metadata: 'note' },
  { id: 'old', side: 'deletions', lineNumber: 20, metadata: 'old' },
];

describe('overlay annotation layout', () => {
  test('renders no annotation rows, so code rows never shift', async () => {
    const withAnnotations = setup(ANNOTATIONS);
    try {
      await waitForCode(withAnnotations.container);
      const shadow = withAnnotations.shadow();
      expect(shadow.querySelectorAll('[data-line-annotation]').length).toBe(0);
      expect(
        shadow.querySelectorAll("[data-gutter-buffer='annotation']").length
      ).toBe(0);
      const rowIndexes = Array.from(
        shadow.querySelectorAll('[data-content] [data-line]'),
        (row) => row.getAttribute('data-line-index')
      );
      withAnnotations.instance.render({
        fileDiff: withAnnotations.fileDiff,
        lineAnnotations: [],
        forceRender: true,
      });
      expect(
        Array.from(
          shadow.querySelectorAll('[data-content] [data-line]'),
          (row) => row.getAttribute('data-line-index')
        )
      ).toEqual(rowIndexes);
    } finally {
      withAnnotations.cleanup();
    }
  });

  test('changing overlay annotations does not re-render the code', async () => {
    const ctx = setup(ANNOTATIONS);
    try {
      await waitForCode(ctx.container);
      const code = ctx.shadow().querySelector('code');
      ctx.instance.render({
        fileDiff: ctx.fileDiff,
        lineAnnotations: ANNOTATIONS.slice(0, 1),
      });
      expect(ctx.shadow().querySelector('code')).toBe(code);
      expect(
        ctx.shadow().querySelectorAll('[data-overlay-item]').length
      ).toBe(1);
    } finally {
      ctx.cleanup();
    }
  });

  test('builds one item per anchor with pin and body slots per annotation', async () => {
    const ctx = setup(ANNOTATIONS);
    try {
      await waitForCode(ctx.container);
      const items = ctx.shadow().querySelectorAll('[data-overlay-item]');
      expect(items.length).toBe(3);
      const slotNames = Array.from(
        ctx.shadow().querySelectorAll('[data-annotation-overlay] slot'),
        (slot) => slot.getAttribute('name')
      );
      for (const id of ['doc', 'graph', 'note', 'old']) {
        expect(slotNames).toContain(getOverlayPinSlotName(id));
        expect(slotNames).toContain(getOverlayBodySlotName(id));
      }
      expect(slotNames).toContain('overlay-hint');
      expect(ctx.container.dataset.annotationLayout).toBe('overlay');
    } finally {
      ctx.cleanup();
    }
  });

  test('aligns items to measured anchor rows and stacks collisions', async () => {
    const ctx = setup(ANNOTATIONS);
    try {
      await waitForCode(ctx.container);
      const layout = ctx.instance.layoutAnnotationOverlay();
      const byKey = new Map(layout.map((entry) => [entry.anchorKey, entry]));
      const rowTop = (side: 'deletions' | 'additions', line: number) =>
        rowTopOf(
          ctx
            .shadow()
            .querySelector(
              `[data-content] [data-line][data-line-index^="${ctx.instance.getLineIndex(line, side)![0]},"]`
            )!
        );

      const deletion = byKey.get('deletions:20')!;
      const add20 = byKey.get('additions:20')!;
      const add21 = byKey.get('additions:21')!;
      expect(deletion.source).toBe('measured');
      expect(deletion.anchorTop).toBe(rowTop('deletions', 20));
      expect(deletion.top).toBe(deletion.anchorTop);
      expect(deletion.displaced).toBe(false);
      expect(add20.anchorTop).toBe(rowTop('additions', 20));
      expect(add21.anchorTop).toBe(rowTop('additions', 21));
      // Stacking: an item never starts above its anchor row and never
      // overlaps the item above it (22px items, 2px gap, 20px rows).
      const ordered = [deletion, add20, add21].sort(
        (a, b) => a.anchorTop! - b.anchorTop!
      );
      for (let i = 1; i < ordered.length; i++) {
        expect(ordered[i].top!).toBe(
          Math.max(ordered[i].anchorTop!, ordered[i - 1].top! + ITEM_HEIGHT + 2)
        );
      }
      // Additions 20 and 21 sit on adjacent rows, so 21 is pushed down.
      expect(add21.anchorTop! - add20.anchorTop!).toBe(ROW_HEIGHT);
      expect(add21.displaced).toBe(true);
      expect(add21.top).toBe(add20.top! + ITEM_HEIGHT + 2);
      const element = ctx
        .shadow()
        .querySelector<HTMLElement>(
          "[data-overlay-item][data-side='deletions'][data-line-number='20']"
        )!;
      expect(element.style.transform).toBe(
        `translateY(${deletion.top}px)`
      );
      expect(element.hidden).toBe(false);
    } finally {
      ctx.cleanup();
    }
  });

  test('tags anchored rows for the L0 hint and the expanded anchor ring', async () => {
    const ctx = setup(ANNOTATIONS);
    try {
      await waitForCode(ctx.container);
      const anchored = ctx
        .shadow()
        .querySelectorAll('[data-content] [data-overlay-anchor]');
      expect(anchored.length).toBe(3);
      ctx.instance.expandAnnotation('graph');
      const ringed = ctx
        .shadow()
        .querySelectorAll('[data-content] [data-overlay-anchor-expanded]');
      expect(ringed.length).toBe(1);
      expect(ringed[0].getAttribute('data-line')).toBe('21');
    } finally {
      ctx.cleanup();
    }
  });

  test('expanding is exclusive and isolates the other items', async () => {
    const ctx = setup(ANNOTATIONS);
    try {
      await waitForCode(ctx.container);
      const shadow = ctx.shadow();
      const layer = shadow.querySelector('[data-annotation-overlay]')!;
      ctx.instance.showAnnotationHint('doc');
      expect(
        shadow.querySelector<HTMLElement>('[data-overlay-hint]')!.hidden
      ).toBe(false);

      ctx.instance.expandAnnotation('doc');
      ctx.instance.expandAnnotation('graph');
      expect(ctx.instance.getAnnotationOverlayState()?.expandedId).toBe('graph');
      expect(layer.hasAttribute('data-has-expanded')).toBe(true);
      const expanded = shadow.querySelectorAll('[data-overlay-item][data-expanded]');
      expect(expanded.length).toBe(1);
      expect(expanded[0].getAttribute('data-line-number')).toBe('21');
      const inert = shadow.querySelectorAll('[data-overlay-item][inert]');
      expect(inert.length).toBe(2);
      expect(expanded[0].hasAttribute('inert')).toBe(false);
      // The shared hint never shows while an item is expanded.
      expect(
        shadow.querySelector<HTMLElement>('[data-overlay-hint]')!.hidden
      ).toBe(true);
      ctx.instance.showAnnotationHint('doc');
      expect(ctx.instance.getAnnotationOverlayState()?.hintId).toBeUndefined();

      ctx.instance.expandAnnotation(undefined);
      expect(layer.hasAttribute('data-has-expanded')).toBe(false);
      expect(shadow.querySelectorAll('[data-overlay-item][inert]').length).toBe(0);
    } finally {
      ctx.cleanup();
    }
  });

  test('dismisses one annotation or all of them back to their pins', async () => {
    const ctx = setup(ANNOTATIONS);
    try {
      await waitForCode(ctx.container);
      const shadow = ctx.shadow();
      const body = (id: string) =>
        shadow.querySelector<HTMLElement>(
          `[data-overlay-body][data-annotation-id='${id}']`
        )!;
      ctx.instance.dismissAnnotation('note');
      expect(body('note').hasAttribute('data-dismissed')).toBe(true);
      expect(body('graph').hasAttribute('data-dismissed')).toBe(false);
      // Pins stay: the pin slot is untouched by dismissal.
      expect(
        shadow.querySelector(`slot[name='${getOverlayPinSlotName('note')}']`)
      ).not.toBeNull();

      ctx.instance.reopenAnnotation('note');
      expect(body('note').hasAttribute('data-dismissed')).toBe(false);

      ctx.instance.expandAnnotation('doc');
      ctx.instance.dismissAllAnnotations();
      const state = ctx.instance.getAnnotationOverlayState()!;
      expect(state.dismissedIds.sort()).toEqual(['doc', 'graph', 'note', 'old']);
      expect(state.expandedId).toBeUndefined();
      expect(
        shadow.querySelectorAll('[data-overlay-item][data-all-dismissed]').length
      ).toBe(3);

      ctx.instance.reopenAllAnnotations();
      expect(ctx.instance.getAnnotationOverlayState()!.dismissedIds).toEqual([]);
    } finally {
      ctx.cleanup();
    }
  });

  test('keeps items aligned after a hunk expands above them', async () => {
    const ctx = setup(ANNOTATIONS);
    try {
      await waitForCode(ctx.container);
      const before = ctx.instance
        .layoutAnnotationOverlay()
        .find((entry) => entry.anchorKey === 'additions:20')!;
      ctx.instance.expandHunk(0, 'up');
      await waitForCode(ctx.container);
      const after = ctx.instance
        .layoutAnnotationOverlay()
        .find((entry) => entry.anchorKey === 'additions:20')!;
      const expectedTop = rowTopOf(
        ctx
          .shadow()
          .querySelector(
            `[data-content] [data-line][data-line-index^="${ctx.instance.getLineIndex(20, 'additions')![0]},"]`
          )!
      );
      expect(after.source).toBe('measured');
      expect(after.anchorTop).toBe(expectedTop);
      // Expanding added rows above the anchor, so its row (and item) moved.
      expect(after.anchorTop!).toBeGreaterThan(before.anchorTop!);
    } finally {
      ctx.cleanup();
    }
  });

  test('hides items whose line is folded inside collapsed context', async () => {
    const ctx = setup([
      ...ANNOTATIONS,
      { id: 'folded', side: 'additions', lineNumber: 2, metadata: 'folded' },
    ]);
    try {
      await waitForCode(ctx.container);
      const folded = ctx.instance
        .layoutAnnotationOverlay()
        .find((entry) => entry.anchorKey === 'additions:2')!;
      expect(folded.source).toBe('unavailable');
      expect(folded.top).toBeUndefined();
    } finally {
      ctx.cleanup();
    }
  });

  test('vanilla renderAnnotation and renderAnnotationPin fill the overlay slots', async () => {
    const dom = installDom();
    const container = document.createElement('div');
    const instance = new FileDiff<string>({
      diffStyle: 'unified',
      disableFileHeader: true,
      annotationLayout: 'overlay',
      renderAnnotation: (annotation) => {
        const element = document.createElement('p');
        element.textContent = annotation.metadata;
        return element;
      },
      renderAnnotationPin: (annotation) => {
        const element = document.createElement('button');
        element.textContent = annotation.id ?? '';
        return element;
      },
    });
    try {
      instance.render({
        fileContainer: container,
        fileDiff: parseDiffFromFile(oldFile, newFile),
        lineAnnotations: ANNOTATIONS.slice(0, 1),
      });
      await waitForCode(container);
      const slotted = Array.from(container.children, (child) => child.slot);
      expect(slotted).toContain(getOverlayBodySlotName('doc'));
      expect(slotted).toContain(getOverlayPinSlotName('doc'));
    } finally {
      instance.cleanUp();
      dom.cleanup();
    }
  });

  test('inline layout (upstream default) still renders annotation rows', async () => {
    const dom = installDom();
    const container = document.createElement('div');
    const instance = new FileDiff<string>({
      diffStyle: 'unified',
      disableFileHeader: true,
    });
    try {
      instance.render({
        fileContainer: container,
        fileDiff: parseDiffFromFile(oldFile, newFile),
        lineAnnotations: ANNOTATIONS.slice(0, 1),
      });
      await waitForCode(container);
      expect(
        container.shadowRoot!.querySelectorAll('[data-line-annotation]').length
      ).toBe(1);
      expect(
        container.shadowRoot!.querySelector('[data-annotation-overlay]')
      ).toBeNull();
    } finally {
      instance.cleanUp();
      dom.cleanup();
    }
  });
});

describe('overlay annotation layout in a virtualized diff', () => {
  test('places items for rows outside the render window from the virtual layout', async () => {
    const { VirtualizedFileDiff } = await import(
      '../src/components/VirtualizedFileDiff'
    );
    const dom = installDom();
    const restoreGeometry = installGeometry();
    const longLines = Array.from({ length: 600 }, (_, i) => `row ${i + 1}`);
    const longOld = { name: 'long.ts', contents: `${longLines.join('\n')}\n` };
    const longNew = {
      name: 'long.ts',
      contents: `${longLines
        .map((line, i) => (i === 4 || i === 549 ? `${line} changed` : line))
        .join('\n')}\n`,
    };
    const virtualizer = {
      config: { resizeDebugging: false, overscrollSize: 0 },
      type: 'simple',
      connect() {},
      disconnect() {},
      getOffsetInScrollContainer() {
        return 0;
      },
      getWindowSpecs() {
        return { top: 0, bottom: 200 };
      },
      instanceChanged() {},
      isInstanceVisible() {
        return true;
      },
      markDOMDirty() {},
      requestHeightReconcile() {},
    };
    const container = document.createElement('diffs-container');
    document.body.appendChild(container);
    const instance = new VirtualizedFileDiff<string>(
      {
        diffStyle: 'unified',
        disableFileHeader: true,
        annotationLayout: 'overlay',
        expandUnchanged: true,
      },
      virtualizer as never
    );
    try {
      instance.render({
        fileContainer: container,
        fileDiff: parseDiffFromFile(longOld, longNew),
        lineAnnotations: [
          { id: 'near', side: 'additions', lineNumber: 5, metadata: 'near' },
          { id: 'far', side: 'additions', lineNumber: 550, metadata: 'far' },
        ],
      });
      await waitForCode(container);
      const layout = instance.layoutAnnotationOverlay();
      const far = layout.find((entry) => entry.anchorKey === 'additions:550')!;
      expect(instance.getAnnotationOverlayLayout()).toBe(layout);
      expect(far.source).toBe('estimated');
      expect(far.anchorTop).toBe(instance.getLinePosition(550, 'additions')!.top);
      expect(far.top).toBe(far.anchorTop);
      const near = layout.find((entry) => entry.anchorKey === 'additions:5')!;
      expect(near.source).toBe('measured');
      // No annotation rows: the estimate is plain row arithmetic.
      expect(
        container.shadowRoot!.querySelectorAll('[data-line-annotation]').length
      ).toBe(0);
    } finally {
      instance.cleanUp();
      restoreGeometry();
      dom.cleanup();
    }
  });
});

describe('overlay stacking rules', () => {
  test('the expanded item sits on its anchor and moves no other item', async () => {
    const ctx = setup(ANNOTATIONS);
    try {
      await waitForCode(ctx.container);
      const before = ctx.instance.layoutAnnotationOverlay();
      ctx.instance.expandAnnotation('graph');
      const after = ctx.instance.layoutAnnotationOverlay();
      const expanded = after.find((e) => e.anchorKey === 'additions:21')!;
      expect(expanded.top).toBe(expanded.anchorTop);
      expect(expanded.displaced).toBe(false);
      for (const entry of after) {
        if (entry.anchorKey === 'additions:21') continue;
        const previous = before.find((e) => e.anchorKey === entry.anchorKey)!;
        expect(entry.top).toBe(previous.top);
      }
    } finally {
      ctx.cleanup();
    }
  });

  test('stacks are kept inside the host: overflow moves items up, never overlapping', async () => {
    const ctx = setup(ANNOTATIONS);
    const proto = HTMLElement.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
    try {
      await waitForCode(ctx.container);
      const unconstrained = ctx.instance.layoutAnnotationOverlay();
      const lowest = Math.max(
        ...unconstrained.map((entry) => entry.top! + ITEM_HEIGHT)
      );
      // Pretend the host ends 30px above the lowest item.
      const limit = lowest - 30;
      Object.defineProperty(proto, 'clientHeight', {
        configurable: true,
        get(this: HTMLElement) {
          return this.hasAttribute('data-annotation-overlay') ? limit : 0;
        },
      });
      const contained = ctx.instance
        .layoutAnnotationOverlay()
        .filter((entry) => entry.top != null)
        .sort((a, b) => a.top! - b.top!);
      expect(contained.at(-1)!.top! + ITEM_HEIGHT).toBeLessThanOrEqual(limit);
      for (let i = 1; i < contained.length; i++) {
        expect(contained[i].top!).toBeGreaterThanOrEqual(
          contained[i - 1].top! + ITEM_HEIGHT + 2
        );
      }
      expect(contained.some((entry) => entry.top! < entry.anchorTop!)).toBe(
        true
      );
    } finally {
      if (original != null) {
        Object.defineProperty(proto, 'clientHeight', original);
      }
      ctx.cleanup();
    }
  });

  test('page-wide isolation dims every item and suppresses the hint', async () => {
    const ctx = setup(ANNOTATIONS);
    try {
      await waitForCode(ctx.container);
      const shadow = ctx.shadow();
      ctx.instance.setAnnotationOverlayState({ isolated: true });
      expect(
        shadow
          .querySelector('[data-annotation-overlay]')!
          .hasAttribute('data-has-expanded')
      ).toBe(true);
      expect(shadow.querySelectorAll('[data-overlay-item][inert]').length).toBe(
        3
      );
      ctx.instance.showAnnotationHint('doc');
      expect(ctx.instance.getAnnotationOverlayState()?.hintId).toBeUndefined();
    } finally {
      ctx.cleanup();
    }
  });

  test('state set before the first render is kept', async () => {
    const dom = installDom();
    const container = document.createElement('div');
    const instance = new FileDiff<string>({
      diffStyle: 'unified',
      disableFileHeader: true,
      annotationLayout: 'overlay',
    });
    try {
      instance.setAnnotationOverlayState({
        expandedId: 'doc',
        dismissedIds: ['graph'],
      });
      instance.render({
        fileContainer: container,
        fileDiff: parseDiffFromFile(oldFile, newFile),
        lineAnnotations: ANNOTATIONS,
      });
      await waitForCode(container);
      const state = instance.getAnnotationOverlayState()!;
      expect(state.expandedId).toBe('doc');
      expect(state.dismissedIds).toEqual(['graph']);
    } finally {
      instance.cleanUp();
      dom.cleanup();
    }
  });

  test('expand buttons are focusable and expand on Enter', async () => {
    const ctx = setup(ANNOTATIONS);
    try {
      await waitForCode(ctx.container);
      const button = ctx
        .shadow()
        .querySelector<HTMLElement>('[data-expand-button]')!;
      expect(button.getAttribute('tabindex')).toBe('0');
      expect(button.getAttribute('aria-label')).toMatch(/Expand unchanged/);
      const rowsBefore = ctx
        .shadow()
        .querySelectorAll('[data-content] [data-line]').length;
      const view = button.ownerDocument.defaultView!;
      button.dispatchEvent(
        new view.KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          composed: true,
        })
      );
      await waitForCode(ctx.container);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(
        ctx.shadow().querySelectorAll('[data-content] [data-line]').length
      ).toBeGreaterThan(rowsBefore);
    } finally {
      ctx.cleanup();
    }
  });
});

describe('range highlight', () => {
  test('tints every rendered row and gutter cell of a mixed-side range', async () => {
    const ctx = setup(ANNOTATIONS);
    try {
      await waitForCode(ctx.container);
      ctx.instance.setAnnotationOverlayState({
        highlight: {
          range: { start: 20, side: 'deletions', end: 21, endSide: 'additions' },
          tone: 'strong',
        },
      });
      const tinted = ctx
        .shadow()
        .querySelectorAll("[data-content] [data-line][data-overlay-range='strong']");
      // −20, −21, +20, +21 in display order.
      expect(Array.from(tinted, (row) => row.getAttribute('data-line'))).toEqual(
        ['20', '21', '20', '21']
      );
      expect(
        ctx
          .shadow()
          .querySelectorAll("[data-column-number][data-overlay-range='strong']")
          .length
      ).toBe(4);
      ctx.instance.setAnnotationOverlayState({ highlight: undefined });
      expect(
        ctx.shadow().querySelectorAll('[data-overlay-range]').length
      ).toBe(0);
    } finally {
      ctx.cleanup();
    }
  });
});

describe('keyboard line selection (NEUVE FORK)', () => {
  async function setupKeyboard() {
    const dom = installDom();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const committed: unknown[] = [];
    const selected: unknown[] = [];
    const instance = new FileDiff<string>({
      diffStyle: 'unified',
      disableFileHeader: true,
      enableLineSelection: true,
      enableKeyboardLineSelection: true,
      touchTapExtendsSelection: true,
      onLineSelected: (range) => selected.push(range),
      onLineSelectionCommit: (range) => committed.push(range),
    });
    instance.render({
      fileContainer: container,
      fileDiff: parseDiffFromFile(oldFile, newFile),
    });
    await waitForCode(container);
    const root = container.shadowRoot!;
    const view = container.ownerDocument.defaultView!;
    const press = (cell: Element, key: string, shiftKey = false) =>
      cell.dispatchEvent(
        new view.KeyboardEvent('keydown', {
          key,
          shiftKey,
          bubbles: true,
          composed: true,
        })
      );
    return {
      root,
      instance,
      press,
      committed,
      selected,
      cleanup() {
        instance.cleanUp();
        dom.cleanup();
      },
    };
  }

  test('one gutter cell is the tab stop, on the first changed line', async () => {
    const ctx = await setupKeyboard();
    try {
      const stops = ctx.root.querySelectorAll('[data-column-number][tabindex="0"]');
      expect(stops.length).toBe(1);
      expect(stops[0].getAttribute('data-line-type')).toBe('change-deletion');
    } finally {
      ctx.cleanup();
    }
  });

  test('Shift+↓ extends across deletion and addition rows; Enter commits', async () => {
    const ctx = await setupKeyboard();
    try {
      const first = ctx.root.querySelector<HTMLElement>(
        '[data-column-number][tabindex="0"]'
      )!;
      ctx.press(first, ' ');
      expect(ctx.selected.at(-1)).toEqual({ start: 20, side: 'deletions', end: 20 });
      ctx.press(first, 'ArrowDown', true);
      const focused = ctx.root.querySelector<HTMLElement>(
        '[data-column-number][tabindex="0"]'
      )!;
      expect(focused).not.toBe(first);
      ctx.press(focused, 'ArrowDown', true);
      const last = ctx.root.querySelector<HTMLElement>(
        '[data-column-number][tabindex="0"]'
      )!;
      ctx.press(last, 'Enter');
      expect(ctx.committed.at(-1)).toEqual({
        start: 20,
        side: 'deletions',
        end: 20,
        endSide: 'additions',
      });
      ctx.press(last, 'Escape');
      expect(ctx.selected.at(-1)).toBeNull();
    } finally {
      ctx.cleanup();
    }
  });

  test('C on an unselected line selects it and commits a single line', async () => {
    const ctx = await setupKeyboard();
    try {
      const cell = ctx.root.querySelector<HTMLElement>(
        "[data-column-number][data-line-type='change-addition']"
      )!;
      ctx.press(cell, 'c');
      expect(ctx.committed.at(-1)).toEqual({
        start: 20,
        side: 'additions',
        end: 20,
      });
    } finally {
      ctx.cleanup();
    }
  });
});

describe('touch selection (NEUVE FORK)', () => {
  test('tap selects a line; tapping another line number extends', async () => {
    const dom = installDom();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const selected: unknown[] = [];
    const instance = new FileDiff<string>({
      diffStyle: 'unified',
      disableFileHeader: true,
      enableLineSelection: true,
      touchTapExtendsSelection: true,
      onLineSelected: (range) => selected.push(range),
    });
    try {
      instance.render({
        fileContainer: container,
        fileDiff: parseDiffFromFile(oldFile, newFile),
      });
      await waitForCode(container);
      const view = container.ownerDocument.defaultView!;
      const tap = (cell: Element) => {
        cell.dispatchEvent(
          new view.PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerType: 'touch',
            pointerId: 7,
          })
        );
        view.document.dispatchEvent(
          new view.PointerEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerType: 'touch',
            pointerId: 7,
          })
        );
      };
      const cells = container.shadowRoot!.querySelectorAll(
        "[data-column-number][data-line-type^='change']"
      );
      tap(cells[0]);
      expect(selected.at(-1)).toEqual({ start: 20, side: 'deletions', end: 20 });
      tap(cells[3]);
      expect(selected.at(-1)).toEqual({
        start: 20,
        side: 'deletions',
        end: 21,
        endSide: 'additions',
      });
    } finally {
      instance.cleanUp();
      dom.cleanup();
    }
  });
});
