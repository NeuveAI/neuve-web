# @workspace/diffs — Neuve fork of Pierre diffs

This package is a modified fork of [`@pierre/diffs`](https://diffs.com) by
[The Pierre Computer Company](https://pierre.computer), licensed under
Apache-2.0 ([LICENSE.md](LICENSE.md)). What changed and why is listed in
[NOTICE.md](NOTICE.md); every modified place in the source carries a
`NEUVE FORK` comment.

The main addition is an **overlay annotation layer**: with
`annotationLayout: 'overlay'`, line annotations render in a positioned layer
beside the code instead of as rows inside it, so code rows never shift. See
`src/managers/AnnotationOverlayManager.ts` for how items are aligned and
stacked.

```bash
# from apps/neuve-web
bun run --filter @workspace/diffs test       # bun test
bun run --filter @workspace/diffs typecheck  # tsc + declaration emit
```

The upstream README follows, unchanged; its pnpm/moon instructions apply to
the upstream repository, not to this workspace.

---

# Diffs, from Pierre

`@pierre/diffs` is an open source diff and file rendering library built on
[Shiki](https://shiki.style/). It's super customizable and packed with the
features you need. Made with love by
[The Pierre Computer Company](https://pierre.computer). Available as vanilla
JavaScript and React components.

**View examples and read documentation on [Diffs.com](https://diffs.com).**

## Features

- Diff file versions, patches, and arbitrary files
- Split or stacked layout
- Automatically adapts to Shiki themes
- Supports light and dark mode
- Options for diff highlight styles, in-line highlighting, wrapping, line
  numbers, and more
- Supports custom fonts and `font-feature-settings`
- Flexible annotation framework for injecting comments, annotations, and more
- Add your own accept/reject changes UI
- Select and highlight lines

## Install

```bash
pnpm add @pierre/diffs
```

## Agent skill

Install the agent skill for this package with the
[Skills CLI](https://skills.sh/docs/cli):

```bash
npx skills add pierrecomputer/pierre --skill diffs
```

## Development

We use pnpm for workspace package management and Bun for tests.

```bash
# From the root of the monorepo: setup dependencies
pnpm install

# Start the demo vite test server
moonx demo:dev

# To run the docs (diffs site)
moonx docs:dev-diffs
```

### Testing

```bash
# Run tests and related command from within the package directory
bun test

# Update snapshots
bun test --update-snapshots

# Type checking
moonx diffs:typecheck
```

Tests are located in the `test/` folder and use Bun's native testing framework
with snapshot support.

## Publishing

**Applicable to the Pierre team only.**

```bash
# You may need to login first:
pnpm login

# Always run publish from within the package directory.
cd packages/diffs
pnpm publish
# In a CI-marked shell: CI= pnpm publish
```

## Building the sprite

The diff UI uses an SVG sprite built from `@pierre/icons`. From the monorepo
root:

```bash
moonx root:icons
```

This reads SVGs from `node_modules/@pierre/icons/svg` and writes
`packages/diffs/src/sprite.ts`. Run after updating `@pierre/icons` or changing
`sprite.config.js`.
