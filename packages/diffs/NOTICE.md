# NOTICE

`@workspace/diffs` is a modified copy of **`@pierre/diffs`** 1.5.1 by The
Pierre Computer Company (<https://github.com/pierrecomputer/pierre>,
`packages/diffs`, upstream commit `228c5848`), licensed under the Apache
License 2.0. The original license is kept unchanged in [`LICENSE.md`](LICENSE.md).
This file describes the modifications, as section 4(b) of that license asks.

Copyright for the original work remains with its authors. The modifications
below were made in 2026 for the Neuve web workspace and are distributed under
the same Apache-2.0 license.

## What was copied

- `src/` (minus `src/react/` and `src/ssr/`), `test/`, `README.md`,
  `LICENSE.md`.
- Four demo mock files the upstream tests read from `apps/demo/src/mocks/`
  are vendored under `test/fixtures/` (`fileOld.txt`, `fileNew.txt`,
  `diff.patch`, `fileConflictLarge.txt`); the tests point at them.

## What was removed

- `src/react/` and `src/ssr/` (the React bindings and server rendering).
  Neuve's React binding lives in `packages/ui` and keeps its state in jotai;
  the fork itself stays framework-agnostic (vanilla DOM + web component).
  `src/utils/areOptionsEqual.ts` now imports `FileOptions` from
  `components/File` instead of the removed React entry.
- The React/SSR test files, and the Playwright e2e suite (it builds `dist` and
  runs through pnpm/moon).

## Build and tooling

- pnpm + moon + tsdown → bun + turbo. The package is consumed as TypeScript
  source (`exports` → `src/*.ts`; Vite bundles it, including the worker via
  `?worker`). `typecheck` also emits declarations to `dist/types` for
  consumers' `tsc`. Tests still run with `bun test`.

## Functional modifications

All modified places carry a `NEUVE FORK` comment.

1. **Overlay annotation layer** (`annotationLayout: 'overlay'`).
   - New `src/managers/AnnotationOverlayManager.ts`: a positioned layer in the
     shadow root, beside the code, with one item per anchor (side + line),
     per-annotation pin and body slots, a single shared hint slot, collision
     stacking (downward, then contained inside the host), and state: one
     expanded annotation (isolation: other items dimmed, `inert`, no pointer;
     optional page-wide isolation), dismissed annotations (body collapses to
     the pin), dismiss/reopen all, hint. Alignment and the update triggers are
     documented at the top of that file.
   - `src/components/FileDiff.ts`: in overlay mode the hunks renderer gets no
     annotations, so no annotation rows exist and code rows never shift;
     annotation changes no longer force a code re-render; new public methods
     (`expandAnnotation`, `dismissAnnotation`, `reopenAnnotation`,
     `dismissAllAnnotations`, `reopenAllAnnotations`, `showAnnotationHint`,
     `hideAnnotationHint`, `setAnnotationOverlayState`,
     `getAnnotationOverlayState`, `getAnnotationOverlayLayout`,
     `layoutAnnotationOverlay`) and options (`annotationLayout`,
     `annotationOverlay`, `renderAnnotationPin`).
   - `src/components/VirtualizedFileDiff.ts`: places items for rows outside
     the render window from `getLinePosition()`; overlay annotations do not
     force re-renders or count as a file-annotation row.
   - `src/types.ts`: optional `id` on `DiffLineAnnotation` (also compared in
     `areDiffLineAnnotationsEqual`).
   - `src/style.css`: overlay layer styles (geometry via
     `--diffs-overlay-*` custom properties, L0 underline, expanded and
     active anchor rings, reduced-motion fallbacks).
2. **Keyboard access to hunk expansion.** Expand buttons are focusable with an
   accessible name (`src/utils/createSeparator.ts`) and activate on
   Enter/Space (`src/managers/InteractionManager.ts`).
3. **Tests.** `test/annotationOverlay.test.ts` covers the overlay layer; all
   retained upstream tests pass unchanged.

## Not verified

- The overlay layer inside `CodeView` (multi-file virtualized lists), edit
  sessions with overlay annotations, and split view with the overlay.
