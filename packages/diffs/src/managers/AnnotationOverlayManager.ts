// NEUVE FORK: new file. See NOTICE.md ("Overlay annotation layer").
//
// Upstream Pierre renders every line annotation as an extra row inside the
// code grid (`[data-line-annotation]`), so opening an annotation pushes the
// code below it down. In `annotationLayout: 'overlay'` mode the renderer is
// given no annotations at all and this manager instead renders them into a
// separate, absolutely positioned layer inside the same shadow root. The code
// rows never move; only the layer's items do.
//
// Alignment
// ---------
// The layer is a sibling of the `<pre>` and is positioned against the host
// element (`:host([data-annotation-layout='overlay'])` is `position:
// relative`). Each item is placed with `transform: translateY(top)` where
// `top` is the anchor row's offset from the top of the host:
//
//   1. If the anchor row is rendered, `top = row.top - layer.top` from
//      `getBoundingClientRect()`. Both rectangles live in the same scroll
//      content, so the difference does not change while scrolling and no
//      scroll listener is needed.
//   2. If the row is not rendered (virtualized out of the window), the host
//      supplies a layout estimate — VirtualizedFileDiff uses
//      `getLinePosition()`, which already accounts for expanded hunks,
//      separators and measured row heights. The estimate is replaced by a
//      measurement as soon as the row renders again.
//   3. Otherwise (the line is folded inside collapsed context) the item is
//      hidden until the line becomes renderable.
//
// After the anchor tops are known, items are stacked in anchor order: an item
// never starts above its anchor, and never overlaps the item above it
// (`top_i = max(anchorTop_i, bottom_{i-1} + gap)`). A pushed item is flagged
// `data-displaced`. Layout runs after every render (scroll windows,
// expandHunk, diff or option changes), on host and item resize, and when
// slotted content changes, always coalesced into one animation frame.
//
// Isolation
// ---------
// At most one annotation is expanded per layer. While one is, every other
// item is dimmed, `inert` (no focus, no pointer) and the shared hint is
// hidden. Dismissed annotations collapse to their pin: only their body slot
// is hidden, so the L0 pin stays visible and can reopen it.
import type {
  AnnotationSide,
  DiffLineAnnotation,
  SelectedLineRange,
} from '../types';

export type AnnotationLayout = 'inline' | 'overlay';

export interface AnnotationOverlayAnchor {
  side: AnnotationSide;
  lineNumber: number;
}

export interface AnnotationOverlayEntry extends AnnotationOverlayAnchor {
  /** Stable annotation id: `annotation.id` or a positional fallback. */
  id: string;
}

export type AnnotationOverlayPositionSource =
  | 'measured'
  | 'estimated'
  | 'unavailable';

export interface AnnotationOverlayItemLayout extends AnnotationOverlayAnchor {
  /** `${side}:${lineNumber}` */
  anchorKey: string;
  annotationIds: string[];
  /** Offset of the anchor row from the top of the host, in px. */
  anchorTop: number | undefined;
  /** Where the item was placed after stacking, in px. */
  top: number | undefined;
  height: number;
  /** True when stacking pushed the item below its anchor row. */
  displaced: boolean;
  source: AnnotationOverlayPositionSource;
}

export interface AnnotationOverlayState {
  /** The single expanded annotation in this layer, if any. */
  expandedId: string | undefined;
  /** Annotations collapsed back to their pin. */
  dismissedIds: string[];
  /** Annotation whose pin currently owns the shared hint. */
  hintId: string | undefined;
  /**
   * A layer elsewhere (another file, another surface) is expanded: every item
   * here dims and stops responding too, so isolation spans the whole page.
   */
  isolated: boolean;
  /**
   * A line range to tint on the code, tying an annotation to the lines it is
   * about: `strong` while it is open, `hint` while its pin is pointed at.
   */
  highlight: AnnotationOverlayHighlight | undefined;
}

export interface AnnotationOverlayHighlight {
  range: SelectedLineRange;
  tone: 'strong' | 'hint';
}

export interface AnnotationOverlayHost {
  /** Locate the rendered content row for an anchor, if it is in the DOM. */
  findRenderedRow(anchor: AnnotationOverlayAnchor): HTMLElement | undefined;
  /** Locate every rendered element (content row and gutter cell) to tag. */
  findRenderedRowElements(anchor: AnnotationOverlayAnchor): HTMLElement[];
  /** The element rows are rendered into; tags are cleared from it. */
  getCodeRoot(): HTMLElement | undefined;
  /** Every rendered row element (content rows and gutter cells) in a range. */
  findRangeRowElements(range: SelectedLineRange): HTMLElement[];
  /** Layout estimate (px from host top) for a row that is not rendered. */
  estimateLineTop?(anchor: AnnotationOverlayAnchor): number | undefined;
}

export interface AnnotationOverlayOptions {
  /** Vertical gap between stacked items, px. Defaults to 2. */
  stackGap?: number;
  /** Vertical gap between a pin row and the shared hint, px. Defaults to 6. */
  hintGap?: number;
  /**
   * Keep stacked items inside the host's height (an upward pass after the
   * downward one). Defaults to true; the expanded item is exempt.
   */
  containWithinHost?: boolean;
  onLayout?(layout: AnnotationOverlayItemLayout[]): void;
  onStateChange?(state: AnnotationOverlayState): void;
}

export const OVERLAY_HINT_SLOT_NAME = 'overlay-hint';

export function getOverlayAnnotationId<LAnnotation>(
  annotation: DiffLineAnnotation<LAnnotation>,
  index: number
): string {
  return (
    annotation.id ?? `${annotation.side}:${annotation.lineNumber}:${index}`
  );
}

export function getOverlayAnchorKey(anchor: AnnotationOverlayAnchor): string {
  return `${anchor.side}:${anchor.lineNumber}`;
}

/** Slot for an annotation's L0 pin; always visible. */
export function getOverlayPinSlotName(id: string): string {
  return `overlay-pin:${id}`;
}

/** Slot for an annotation's body; hidden while dismissed (unless expanded). */
export function getOverlayBodySlotName(id: string): string {
  return `overlay-body:${id}`;
}

export function toOverlayEntries<LAnnotation>(
  annotations: DiffLineAnnotation<LAnnotation>[]
): AnnotationOverlayEntry[] {
  return annotations.map((annotation, index) => ({
    id: getOverlayAnnotationId(annotation, index),
    side: annotation.side,
    lineNumber: annotation.lineNumber,
  }));
}

interface OverlayItem {
  anchor: AnnotationOverlayAnchor;
  anchorKey: string;
  element: HTMLDivElement;
  pins: HTMLDivElement;
  bodies: HTMLDivElement;
  ids: string[];
  pinSlots: Map<string, HTMLSlotElement>;
  bodyWrappers: Map<string, HTMLDivElement>;
  layout: AnnotationOverlayItemLayout | undefined;
}

const SIDE_ORDER: Record<AnnotationSide, number> = {
  deletions: 0,
  additions: 1,
};

export class AnnotationOverlayManager {
  private layer: HTMLDivElement | undefined;
  private hint: HTMLDivElement | undefined;
  private items: Map<string, OverlayItem> = new Map();
  private entries: AnnotationOverlayEntry[] = [];
  private expandedId: string | undefined;
  private dismissed: Set<string> = new Set();
  private hintId: string | undefined;
  private isolated = false;
  private highlight: AnnotationOverlayHighlight | undefined;
  private activeAnchorKey: string | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private frame: number | undefined;
  private lastLayout: AnnotationOverlayItemLayout[] = [];
  private visible = true;

  constructor(
    private readonly host: AnnotationOverlayHost,
    private options: AnnotationOverlayOptions = {}
  ) {}

  setOptions(options: AnnotationOverlayOptions): void {
    this.options = options;
  }

  /** Ensure the layer exists inside `shadowRoot`, after the code. */
  attach(hostElement: HTMLElement, shadowRoot: ShadowRoot): void {
    hostElement.dataset.annotationLayout = 'overlay';
    if (this.layer == null) {
      this.layer = document.createElement('div');
      this.layer.dataset.annotationOverlay = '';
      this.layer.setAttribute('role', 'presentation');
      this.layer.addEventListener('slotchange', this.handleSlotChange);
      this.hint = document.createElement('div');
      this.hint.dataset.overlayHint = '';
      this.hint.hidden = true;
      this.hint.setAttribute('aria-hidden', 'true');
      const hintSlot = document.createElement('slot');
      hintSlot.name = OVERLAY_HINT_SLOT_NAME;
      this.hint.appendChild(hintSlot);
      this.layer.appendChild(this.hint);
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(this.handleResize);
        this.resizeObserver.observe(hostElement);
        for (const item of this.items.values()) {
          this.resizeObserver.observe(item.element);
        }
      }
    }
    // Keep the layer last so it paints above the code without z-index games.
    if (this.layer.parentNode !== shadowRoot || this.layer.nextSibling != null) {
      shadowRoot.appendChild(this.layer);
    }
  }

  setAnnotations(entries: AnnotationOverlayEntry[]): void {
    this.entries = entries;
    const byAnchor = new Map<string, AnnotationOverlayEntry[]>();
    for (const entry of entries) {
      const key = getOverlayAnchorKey(entry);
      const list = byAnchor.get(key) ?? [];
      list.push(entry);
      byAnchor.set(key, list);
    }

    for (const [key, item] of this.items) {
      if (!byAnchor.has(key)) {
        this.resizeObserver?.unobserve(item.element);
        item.element.remove();
        this.items.delete(key);
      }
    }

    for (const [key, list] of byAnchor) {
      let item = this.items.get(key);
      if (item == null) {
        item = this.createItem(list[0]);
        this.items.set(key, item);
      }
      this.syncItemSlots(item, list);
    }

    // Forget state for annotations that no longer exist.
    const ids = new Set(entries.map((entry) => entry.id));
    for (const id of this.dismissed) {
      if (!ids.has(id)) this.dismissed.delete(id);
    }
    if (this.expandedId != null && !ids.has(this.expandedId)) {
      this.expandedId = undefined;
    }
    if (this.hintId != null && !ids.has(this.hintId)) {
      this.hintId = undefined;
    }
    this.applyState();
    this.scheduleLayout();
  }

  getEntries(): AnnotationOverlayEntry[] {
    return this.entries;
  }

  /* ── State API ───────────────────────────────────────── */

  getState(): AnnotationOverlayState {
    return {
      expandedId: this.expandedId,
      dismissedIds: [...this.dismissed],
      hintId: this.hintId,
      isolated: this.isolated,
      highlight: this.highlight,
    };
  }

  /** Replace the whole state (hosts that keep state elsewhere sync here). */
  setState(state: Partial<AnnotationOverlayState>): void {
    if ('expandedId' in state) this.expandedId = state.expandedId;
    if (state.dismissedIds != null) this.dismissed = new Set(state.dismissedIds);
    if ('hintId' in state) this.hintId = state.hintId;
    if (state.isolated != null) this.isolated = state.isolated;
    if ('highlight' in state) this.highlight = state.highlight;
    this.commitState();
  }

  /** Expand one annotation; any other expanded annotation collapses. */
  expand(id: string | undefined): void {
    this.expandedId = id;
    if (id != null) this.hintId = undefined;
    this.commitState();
  }

  collapse(): void {
    this.expand(undefined);
  }

  dismiss(id: string): void {
    this.dismissed.add(id);
    if (this.expandedId === id) this.expandedId = undefined;
    this.commitState();
  }

  reopen(id: string): void {
    this.dismissed.delete(id);
    this.commitState();
  }

  dismissAll(): void {
    for (const entry of this.entries) this.dismissed.add(entry.id);
    this.expandedId = undefined;
    this.hintId = undefined;
    this.commitState();
  }

  reopenAll(): void {
    this.dismissed.clear();
    this.commitState();
  }

  /** Show the shared hint under an annotation's pin (hover or focus). */
  showHint(id: string): void {
    if (this.expandedId != null || this.isolated) return;
    this.hintId = id;
    this.commitState();
  }

  hideHint(id?: string): void {
    if (id != null && this.hintId !== id) return;
    this.hintId = undefined;
    this.commitState();
  }

  /** Hide the whole layer (collapsed file, placeholder). */
  setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.layer != null) this.layer.hidden = !visible;
  }

  getLayout(): AnnotationOverlayItemLayout[] {
    return this.lastLayout;
  }

  /** Re-measure after a render. Coalesced into the next frame. */
  sync(): void {
    this.tagRows();
    this.scheduleLayout();
  }

  /** Measure and place immediately (tests, or callers that need it now). */
  layoutNow(): AnnotationOverlayItemLayout[] {
    if (this.frame != null) {
      cancelAnimationFrame(this.frame);
      this.frame = undefined;
    }
    return this.layout();
  }

  cleanUp(): void {
    if (this.frame != null) {
      cancelAnimationFrame(this.frame);
      this.frame = undefined;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.layer?.removeEventListener('slotchange', this.handleSlotChange);
    this.layer?.remove();
    this.layer = undefined;
    this.hint = undefined;
    this.items.clear();
    this.lastLayout = [];
  }

  /* ── Internals ───────────────────────────────────────── */

  private commitState(): void {
    this.applyState();
    this.tagRows();
    this.scheduleLayout();
    this.options.onStateChange?.(this.getState());
  }

  private createItem(anchor: AnnotationOverlayAnchor): OverlayItem {
    const element = document.createElement('div');
    element.dataset.overlayItem = '';
    element.dataset.side = anchor.side;
    element.dataset.lineNumber = `${anchor.lineNumber}`;
    // Shown before the pins when stacking moved the item off its row.
    element.style.setProperty(
      '--diffs-overlay-line-label',
      `"${anchor.side === 'deletions' ? '−' : '+'}${anchor.lineNumber}"`
    );
    element.hidden = true;
    const pins = document.createElement('div');
    pins.dataset.overlayPins = '';
    const bodies = document.createElement('div');
    bodies.dataset.overlayBodies = '';
    element.append(pins, bodies);
    // Pointing at or focusing an item marks its anchor row, so a stacked
    // (displaced) item is still visibly tied to its line.
    const key = getOverlayAnchorKey(anchor);
    const activate = () => this.setActiveAnchor(key);
    const deactivate = () => this.setActiveAnchor(undefined, key);
    element.addEventListener('pointerenter', activate);
    element.addEventListener('pointerleave', deactivate);
    element.addEventListener('focusin', activate);
    element.addEventListener('focusout', deactivate);
    if (this.layer != null) this.layer.insertBefore(element, this.hint ?? null);
    this.resizeObserver?.observe(element);
    return {
      anchor: { side: anchor.side, lineNumber: anchor.lineNumber },
      anchorKey: getOverlayAnchorKey(anchor),
      element,
      pins,
      bodies,
      ids: [],
      pinSlots: new Map(),
      bodyWrappers: new Map(),
      layout: undefined,
    };
  }

  private syncItemSlots(
    item: OverlayItem,
    list: AnnotationOverlayEntry[]
  ): void {
    if (item.element.parentNode == null && this.layer != null) {
      this.layer.insertBefore(item.element, this.hint ?? null);
    }
    const nextIds = list.map((entry) => entry.id);
    for (const id of item.ids) {
      if (nextIds.includes(id)) continue;
      item.pinSlots.get(id)?.remove();
      item.pinSlots.delete(id);
      item.bodyWrappers.get(id)?.remove();
      item.bodyWrappers.delete(id);
    }
    for (const id of nextIds) {
      let pin = item.pinSlots.get(id);
      if (pin == null) {
        pin = document.createElement('slot');
        pin.name = getOverlayPinSlotName(id);
        item.pinSlots.set(id, pin);
      }
      item.pins.appendChild(pin);
      let body = item.bodyWrappers.get(id);
      if (body == null) {
        body = document.createElement('div');
        body.dataset.overlayBody = '';
        body.dataset.annotationId = id;
        const slot = document.createElement('slot');
        slot.name = getOverlayBodySlotName(id);
        body.appendChild(slot);
        item.bodyWrappers.set(id, body);
      }
      item.bodies.appendChild(body);
    }
    item.ids = nextIds;
  }

  private applyState(): void {
    const { layer } = this;
    if (layer == null) return;
    const hasExpanded = this.expandedId != null || this.isolated;
    layer.toggleAttribute('data-has-expanded', hasExpanded);
    for (const item of this.items.values()) {
      const expanded =
        this.expandedId != null && item.ids.includes(this.expandedId);
      item.element.toggleAttribute('data-expanded', expanded);
      // Isolation: everything but the expanded item is dimmed by CSS and made
      // inert here, which removes it from the tab order and from hit-testing
      // (slotted light-DOM content included, since inertness follows the
      // flat tree).
      item.element.toggleAttribute('inert', hasExpanded && !expanded);
      for (const [id, body] of item.bodyWrappers) {
        const dismissed = this.dismissed.has(id) && this.expandedId !== id;
        body.toggleAttribute('data-dismissed', dismissed);
        body.toggleAttribute('data-expanded', this.expandedId === id);
        // A body with nothing slotted takes no space (and adds no gap), so
        // pin-only annotations stack at pin height.
        const slot = body.firstElementChild as HTMLSlotElement | null;
        body.toggleAttribute(
          'data-empty',
          slot == null || slot.assignedNodes().length === 0
        );
      }
      item.element.toggleAttribute(
        'data-all-dismissed',
        item.ids.every((id) => this.dismissed.has(id))
      );
    }
    if (this.hint != null) {
      this.hint.hidden = hasExpanded || this.hintId == null;
    }
  }

  private setActiveAnchor(key: string | undefined, onlyIf?: string): void {
    if (onlyIf != null && this.activeAnchorKey !== onlyIf) return;
    if (this.activeAnchorKey === key) return;
    this.activeAnchorKey = key;
    this.tagRows();
  }

  /** Mark rendered anchor rows so the code can show the L0 hint. */
  private tagRows(): void {
    const root = this.host.getCodeRoot();
    if (root == null) return;
    for (const element of root.querySelectorAll<HTMLElement>(
      '[data-overlay-anchor]'
    )) {
      element.removeAttribute('data-overlay-anchor');
      element.removeAttribute('data-overlay-anchor-expanded');
      element.removeAttribute('data-overlay-anchor-active');
    }
    for (const element of root.querySelectorAll<HTMLElement>(
      '[data-overlay-range]'
    )) {
      element.removeAttribute('data-overlay-range');
    }
    if (this.highlight != null) {
      for (const element of this.host.findRangeRowElements(
        this.highlight.range
      )) {
        element.setAttribute('data-overlay-range', this.highlight.tone);
      }
    }
    const expandedEntry =
      this.expandedId != null
        ? this.entries.find((entry) => entry.id === this.expandedId)
        : undefined;
    for (const item of this.items.values()) {
      const expanded =
        expandedEntry != null &&
        getOverlayAnchorKey(expandedEntry) === item.anchorKey;
      for (const element of this.host.findRenderedRowElements(item.anchor)) {
        element.setAttribute('data-overlay-anchor', '');
        if (expanded) element.setAttribute('data-overlay-anchor-expanded', '');
        if (item.anchorKey === this.activeAnchorKey) {
          element.setAttribute('data-overlay-anchor-active', '');
        }
      }
    }
  }

  private scheduleLayout(): void {
    if (this.frame != null || typeof requestAnimationFrame === 'undefined') {
      return;
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      this.layout();
    });
  }

  private handleResize = (): void => {
    this.scheduleLayout();
  };

  private handleSlotChange = (): void => {
    this.applyState();
    this.scheduleLayout();
  };

  private resolveAnchorTop(
    anchor: AnnotationOverlayAnchor,
    layerTop: number
  ): { top: number | undefined; source: AnnotationOverlayPositionSource } {
    const row = this.host.findRenderedRow(anchor);
    if (row != null) {
      return {
        top: row.getBoundingClientRect().top - layerTop,
        source: 'measured',
      };
    }
    const estimate = this.host.estimateLineTop?.(anchor);
    if (estimate != null) {
      return { top: estimate, source: 'estimated' };
    }
    return { top: undefined, source: 'unavailable' };
  }

  private layout(): AnnotationOverlayItemLayout[] {
    const { layer } = this;
    if (layer == null || !this.visible) {
      this.lastLayout = [];
      return this.lastLayout;
    }
    const layerTop = layer.getBoundingClientRect().top;
    const stackGap = this.options.stackGap ?? 2;

    // Pass 1: read every anchor position.
    const measured: AnnotationOverlayItemLayout[] = [];
    const wasHidden = new Map<string, boolean>();
    for (const item of this.items.values()) {
      const { top, source } = this.resolveAnchorTop(item.anchor, layerTop);
      measured.push({
        ...item.anchor,
        anchorKey: item.anchorKey,
        annotationIds: item.ids,
        anchorTop: top,
        top: undefined,
        height: 0,
        displaced: false,
        source,
      });
    }

    // Pass 2: show placeable items, hide the rest, then read their heights
    // (one forced layout for the whole layer).
    for (const entry of measured) {
      const item = this.items.get(entry.anchorKey)!;
      wasHidden.set(entry.anchorKey, item.element.hidden === true);
      item.element.hidden = entry.anchorTop == null;
    }
    for (const entry of measured) {
      const item = this.items.get(entry.anchorKey)!;
      entry.height = item.element.hidden ? 0 : item.element.offsetHeight;
    }

    // Pass 3: stack in anchor order.
    const placed = measured
      .filter((entry) => entry.anchorTop != null)
      .sort(
        (a, b) =>
          a.anchorTop! - b.anchorTop! || SIDE_ORDER[a.side] - SIDE_ORDER[b.side]
      );
    let bottom = Number.NEGATIVE_INFINITY;
    for (const entry of placed) {
      entry.top = Math.max(entry.anchorTop!, bottom);
      bottom = entry.top + entry.height + stackGap;
    }

    // Upward pass: keep the stack inside the host so items never spill into
    // whatever follows it (the next file's margin). Items that would overflow
    // move up, never overlapping, never above the host top. A final downward
    // pass removes overlaps the clamp can create when the stack is taller
    // than the host, so only that excess overflows at the bottom.
    const limit = layer.clientHeight;
    // clientHeight is 0 before layout (or without one, e.g. jsdom): skip.
    if (this.options.containWithinHost !== false && limit > 0) {
      let ceiling = limit;
      for (let i = placed.length - 1; i >= 0; i--) {
        const entry = placed[i];
        const maxTop = ceiling - entry.height;
        if (entry.top! > maxTop) entry.top = Math.max(0, maxTop);
        ceiling = entry.top! - stackGap;
      }
      let floor = Number.NEGATIVE_INFINITY;
      for (const entry of placed) {
        entry.top = Math.max(entry.top!, floor);
        floor = entry.top + entry.height + stackGap;
      }
    }

    // The expanded item sits on its own anchor row and floats above the
    // (dimmed, inert) others. Stacking above treated it as collapsed, so
    // expanding never moves any other item.
    for (const entry of placed) {
      if (
        this.expandedId != null &&
        entry.annotationIds.includes(this.expandedId)
      ) {
        entry.top = entry.anchorTop!;
      }
      entry.displaced = Math.abs(entry.top! - entry.anchorTop!) > 0.5;
    }

    // Pass 4: write positions.
    for (const entry of measured) {
      const item = this.items.get(entry.anchorKey);
      if (item == null) continue;
      item.layout = entry;
      if (entry.top == null) continue;
      item.element.style.transform = `translateY(${Math.round(entry.top)}px)`;
      item.element.toggleAttribute('data-displaced', entry.displaced);
      item.element.dataset.position = entry.source;
      // Only animate moves of items that were already placed, so the first
      // placement (and a row returning from virtualization) does not slide in.
      item.element.toggleAttribute(
        'data-placed',
        wasHidden.get(entry.anchorKey) === false
      );
    }

    this.placeHint(layerTop);
    this.lastLayout = measured;
    this.options.onLayout?.(measured);
    return measured;
  }

  private placeHint(layerTop: number): void {
    const { hint } = this;
    if (hint == null) return;
    if (this.hintId == null || this.expandedId != null || this.isolated) {
      hint.hidden = true;
      return;
    }
    const id = this.hintId;
    const item = [...this.items.values()].find((candidate) =>
      candidate.ids.includes(id)
    );
    const pinSlot = item?.pinSlots.get(id);
    const pin = pinSlot?.assignedElements()[0];
    if (item == null || item.element.hidden || pin == null) {
      hint.hidden = true;
      return;
    }
    // A `display: contents` wrapper has no box; measure its first child.
    let pinRect = pin.getBoundingClientRect();
    if (pinRect.width === 0 && pinRect.height === 0) {
      pinRect = pin.firstElementChild?.getBoundingClientRect() ?? pinRect;
    }
    const layerRect = this.layer!.getBoundingClientRect();
    const top = pinRect.bottom - layerTop + (this.options.hintGap ?? 6);
    // NEUVE FORK: keep the hint inside the layer. It starts under its pin,
    // but a wide hint (e.g. a comment preview) on a right-hand pin shifts
    // left rather than overflowing the margin.
    hint.hidden = false;
    const maxLeft = Math.max(0, layerRect.width - hint.offsetWidth);
    const left = Math.min(Math.max(0, pinRect.left - layerRect.left), maxLeft);
    hint.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
}
