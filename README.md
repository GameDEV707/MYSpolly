# MYSpolly — Brass: Birmingham (Desktop Edition)

A faithful, offline, cross-platform digital implementation of the board game
**Brass: Birmingham** — a non-commercial fan project. 2–4 players (hot-seat +
AI), three languages (English / Русский / Oʻzbekcha), and a pure, deterministic,
fully unit-tested rules engine driving a "dumb" React UI.

> Engineering plan & rules digest: [`MYSpolly.md`](./MYSpolly.md).
> Asset licensing: [`ASSETS_CREDITS.md`](./ASSETS_CREDITS.md).

## Architecture (one-paragraph)

A framework-agnostic TypeScript **game core** (`src/core/`) exposes
`buildInitialState`, `legalActions`, `validate`, and a pure
`reduce(state, action) → { state, events }`. Humans (via the React UI) and AI
bots (`src/ai/`) both go through the **same** API — one rules authority. The UI
(`src/app/`) renders state and plays the emitted event stream as
animations/sounds. State is plain JSON: seeded RNG + an action log make
save/load and replays deterministic.

## Requirements

- **Node 22+** and **pnpm**. (Desktop build also needs the **Rust** toolchain for
  Tauri, or just Node for the Electron fallback.)

## Develop & build (web)

```bash
pnpm install
pnpm dev            # Vite dev server (http://localhost:5173)
pnpm build          # production web bundle → dist/ (offline-capable, relative base)
pnpm preview        # preview the production build
```

## Quality gates

```bash
pnpm typecheck      # full TS typecheck (app)
pnpm lint           # ESLint (engine forbids `any`)
pnpm test:component # Vitest component tests (jsdom)
pnpm test:e2e       # Playwright end-to-end

# The pure engine is verified with zero third-party deps (works fully offline):
tsc --noEmit -p tsconfig.engine.json
node --test --experimental-strip-types "tests/unit/**/*.test.ts"
```

> The engine, AI, persistence-serialization and i18n bundles are covered by the
> Node test suite. CI (`.github/workflows/`) runs the engine job with no install
> and a full app job (install → typecheck → lint → component tests → build).

## Desktop packaging

### Tauri (primary — tiny, secure binary)

```bash
# one-time: generate app icons from a 1024×1024 source into src-tauri/icons/
pnpm tauri icon path/to/icon.png

pnpm tauri:dev      # run the desktop app against the dev server
pnpm tauri:build    # build installers: .exe (NSIS/MSI), .dmg/.app, .AppImage/.deb
```

The Tauri shell (`src-tauri/`) loads the same web bundle and adds a native window
plus the filesystem/dialog plugins for native save export/import. Saves use
IndexedDB inside the webview, so they work without any native bridge.

### Electron (fallback — larger binary, no Rust)

```bash
pnpm electron:dev    # build the web bundle, then open it in Electron
pnpm electron:build  # package installers via electron-builder → release/
```

## Project layout

```
src/core/        pure game engine (no React) + static data + RNG
src/ai/          heuristic bots (Easy / Normal / Hard)
src/app/         React UI: screens, board, HUD, stores, i18n, audio, animation
src/persistence/ IndexedDB save/load + pure serialization
src-tauri/       Tauri 2 desktop shell
electron/        Electron fallback shell
tests/unit/      engine/AI/persistence/i18n tests (node --test)
tests/component/ React component tests (Vitest)
```

## Legal

Brass: Birmingham is © 2018 Roxley Games (design by Martin Wallace). This is a
personal, non-commercial fan implementation for learning. No publisher artwork is
shipped; all assets are original or royalty-free (see `ASSETS_CREDITS.md`). The
bundled rulebook PDF is an engineering reference and is not redistributed.
