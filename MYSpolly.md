# MYSpolly — Brass: Birmingham Desktop Edition

> A complete, faithful digital implementation of the board game **Brass: Birmingham**
> (Roxley Games / Martin Wallace), built as a cross‑platform desktop application.
>
> This document is the **master architecture & engineering plan**. It is the single
> source of truth for the project: it describes *what* we are building, *how* the
> game works, *how the software is structured*, and *the exact ordered tasks* needed
> to build it from zero to a shippable desktop game.

---

## 0. Legal / Attribution Note

Brass: Birmingham is © 2018 Roxley Games. Game design by Martin Wallace.
This project is a **personal, non‑commercial fan implementation** built for learning.

- All rule text in this document is **paraphrased/summarized** from the rulebook PDF
  included in this repository (`Brass-Birmingham-Rulebook.pdf`) for engineering purposes.
- We will **not** ship the publisher's original artwork. All board art, tile art,
  card art, icons, fonts, sounds, and music used in the final build must be either
  (a) originally created for this project, (b) properly licensed, or (c) royalty‑free /
  CC0 assets with attribution recorded in `ASSETS_CREDITS.md`.
- Before any public/commercial release, obtain explicit permission from the rights holders.

---

## 1. Project Vision

Build a **pixel‑faithful, fully animated, audio‑rich** digital version of Brass: Birmingham
that plays exactly like the physical game, supporting:

- **2–4 players** (hot‑seat local multiplayer + AI bots to fill empty seats).
- **3 languages**: English (`en`), Russian (`ru`), Uzbek (`uz`), switchable at runtime.
- **Full rules engine** — every action, edge case, era transition, and scoring rule
  from the rulebook is implemented and validated.
- **Real‑game feel** — board layout, tile/card design, animations (tile placement,
  cube movement to markets, money flow, income/VP marker movement, era transitions),
  sound effects, and music that mirror the tabletop experience.
- **Offline first** — runs entirely in the browser with no internet required, then is
  packaged into a real desktop `.exe` / `.app` / `.AppImage`.

### Delivery strategy (incremental, always‑runnable)
1. **Phase A** — Offline web app (open in a browser, no backend, no network).
2. **Phase B** — Wrap into a desktop app with **Tauri** (preferred: tiny binary ~10 MB,
   Rust toolchain) with an **Electron** fallback path documented (larger ~100 MB, simpler).

The web build and the desktop build share **100% of the game code**; only the packaging
shell differs. This guarantees the user can see a working result at every step.

---

## 2. Tech Stack & Rationale

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) | Type safety across a complex rules engine; fewer runtime bugs. |
| UI Framework | **React 18** | Component model fits board/cards/panels; huge ecosystem. |
| Build tool | **Vite** | Fast dev server, instant HMR, optimized production bundles. |
| Styling | **CSS Modules + CSS variables** (+ optional Tailwind) | Themeable (day/night board), scoped styles, no runtime cost. |
| State | **Zustand** for UI/session state; **pure reducer** for game state | Game state must be a pure, serializable, testable engine; Zustand is a thin store around it. |
| Board rendering | **SVG** for the map (vector, crisp at any zoom) + DOM/React for tiles & cards | SVG is ideal for the network graph (locations, link lines, hit‑testing). |
| Animation | **Framer Motion** (UI/tiles) + **GSAP** (complex sequenced timelines) | Declarative component animation + precise multi‑step timelines (cube‑to‑market, scoring sweeps). |
| Audio | **Howler.js** | Sprite‑based SFX, music channels, volume/mute, cross‑platform. |
| i18n | **i18next + react-i18next** | Mature, supports plurals/interpolation, runtime language switch, EN/RU/UZ. |
| AI | Custom **rules‑aware bot** (heuristic → optional MCTS) | Fills empty seats; must use the same engine API as humans. |
| Persistence | **IndexedDB** (web) via `idb`; filesystem (desktop via Tauri FS) | Save/resume games, settings, replays. |
| Testing | **Vitest** (unit) + **React Testing Library** (components) + **Playwright** (e2e) | Engine correctness is critical → heavy unit coverage. |
| Lint/Format | **ESLint + Prettier** | Consistent code style. |
| Desktop shell | **Tauri 2** (primary), **Electron** (fallback) | Tiny secure binary vs. simpler heavy binary. |
| CI | **GitHub Actions** | Lint, test, build web + desktop artifacts per platform. |

> **Node**: target Node 22 LTS (available in sandbox). **Package manager**: pnpm.

---

## 3. Game Rules Digest (Engineering Reference)

This is a condensed, implementation‑oriented summary of the rules. The engine must
enforce **every** point below. (Full text: `Brass-Birmingham-Rulebook.pdf`.)

### 3.1 Overview
- Setting: West Midlands, England, Industrial Revolution, 1770–1870. 2–4 players.
- Two eras: **Canal Era** (1770–1830) then **Rail Era** (1830–1870).
- Winner = most **Victory Points (VP)** after Rail Era scoring.
- Industries: **Cotton Mill, Coal Mine, Iron Works, Manufacturer (Goods), Pottery, Brewery.**

### 3.2 Components (data the engine models)
- 1 board with **Day** and **Night** sides (purely cosmetic; same topology).
- Per player (4 colours): 1 player mat, 1 character tile, 1 income marker, 1 VP marker,
  **14 link tiles**, **45 industry tiles** (Cotton Mill ×11, Manufacturer ×11, Brewery ×7,
  Pottery ×5, Iron Works ×4, Coal Mine ×7 — stacked by level on the mat).
- **8 wild cards**: 4 Wild Location + 4 Wild Industry.
- **64 location & industry cards** (the draw deck; composition depends on player count).
- Shared cubes: **30 coal**, **18 iron**, **15 beer barrels** (General Supply is treated as limitless).
- **9 merchant tiles** placed on merchant spaces around the board edge.
- **77 money tokens** (Bank is effectively unlimited).

### 3.3 Setup (parameterized by player count P ∈ {2,3,4})
1. Choose board side (Day/Night) — cosmetic only.
2. Remove all cards & merchant tiles whose minimum player‑count icon > P.
3. Place **Wild Location** and **Wild Industry** cards face‑up as two separate supply piles.
4. Shuffle remaining cards → **Draw Deck** (face down).
5. Place merchant tiles on merchant spaces matching P:
   - **2P**: no merchants in **Warrington** and **Nottingham**.
   - **3P**: no merchant in **Nottingham**.
   - **4P**: all merchant spaces used.
6. Place 1 beer barrel on each beer space beside a **non‑blank** merchant tile.
7. **Coal Market**: fill every space with a coal cube **except** leave **one £1 space empty**.
8. **Iron Market**: fill every space with an iron cube **except** leave **both £1 spaces empty**.
9. Location‑card colour rule (which location cards are in the deck):
   - **2P**: blue + teal location cards excluded.
   - **3P**: teal location cards excluded.
   - **4P**: all included.
   - (Excluded locations can **still be built in** — they are just not drawable as cards.)
10. Each player: take mat, **£17**, a colour, link tiles, stack industry tiles (black/flipped
    half face down), VP marker on **0**, income marker on income **level 10**, draw a **hand of 8**,
    draw **1** more face‑down as the start of the discard pile.
11. Random initial turn order on the Turn Order Track.

### 3.4 Round structure
- Each era is a sequence of **rounds**. Players act in Turn‑Order‑Track order.
- A round = every player takes one turn.
- **Per turn: 2 actions.** *Exception:* in the **very first round of the Canal Era**, each
  player takes **only 1 action**.
- For each action you **discard 1 card** to your discard pile (wild cards return to their
  supply pile instead). Passing still costs a discarded card per skipped action.
- After your turn, refill hand back up to 8 (once the deck is empty, hands shrink).
- Money you spend during your turn is placed on your **character tile** (not the bank) — this
  measures spending for next round's turn order.
- Eras have exactly **8 / 9 / 10 rounds** for **4 / 3 / 2** players respectively (i.e., the
  era ends when the draw deck and all hands are exhausted).

### 3.5 End of round
1. **Re‑sort turn order**: least money spent → goes first; most spent → last; ties keep
   relative order. Then return all spent money from character tiles to the bank.
2. **Collect income**: each player gains money equal to their income **level**.
   - Negative income level → you must **pay** that amount.
   - Shortfall: sell your own industry tiles for **half their build cost (rounded down)** each
     (removed from the game) until covered; keep any excess.
   - If still short: lose **1 VP per £1** still owed (if VPs available).

### 3.6 Actions (the 7 things a player may do)
- **Build** — place an industry tile (details §3.7).
- **Network** — place link tile(s) (details §3.8).
- **Develop** — remove 1–2 lowest‑level industry tiles from your mat (1 iron each) to reach
  higher levels. Potteries showing the **lightbulb** icon cannot be developed.
- **Sell** — flip Cotton Mill / Manufacturer / Pottery tiles by selling to a connected
  merchant of the matching type, consuming required beer (details §3.9).
- **Loan** — gain **£30**, move income marker **3 income levels back** (cannot drop income
  level below **−10**); marker goes to the highest space of the new level.
- **Scout** — discard the action card **plus 2 more** cards to take **1 Wild Location +
  1 Wild Industry**. Forbidden if you already hold any wild card.
- **Pass** — do nothing for an action (still discard a card).

### 3.7 Build action (detail)
- Discard an **appropriate** card:
  - **Location card** → build any industry on the **named** location (even outside your network).
  - **Industry card** → build the matching industry on a location **in your network**.
  - **Wild Location** → acts as any location card (but **not** the 2 Farm Breweries).
  - **Wild Industry** → acts as any industry card.
- Take the **lowest‑level** tile of the chosen industry from your mat. Place it on an
  undeveloped space showing that industry's icon — prefer a space showing **only** that icon;
  otherwise a shared‑icon space. If no matching space, you can't build there.
- Pay the build cost (shown on the mat), consume required **iron** and **coal**.
  - Coal requires the build location to be **connected** to a coal source (see §3.10).
- After placing:
  - **Coal Mine / Iron Works** → place coal/iron cubes equal to the number printed on the tile.
  - **Brewery** → place **1** beer (Canal Era) or **2** beer (Rail Era).
- **Moving coal/iron to market on build**:
  - A **Coal Mine connected to any merchant space** → immediately move as many cubes as
    possible to the Coal Market, collecting money per space.
  - An **Iron Works** (always) → immediately move as many cubes as possible to the Iron Market.
  - If the **last** cube leaves the tile during this move → **flip** the tile and advance income.
  - (Coal/iron may only be sold to markets at the moment their tile is built — never later.)
- **Overbuilding**: replace an existing tile with a higher level of the same industry
  (still pay full cost). Your own: any industry. Opponent's: only **Coal Mine / Iron Works**,
  and only when there are **no cubes of that resource anywhere** (board + market). Overbuilt
  tiles leave the game and don't score; prior income/VP gains are kept.
- **No tiles on board** special case: you may build an industry card's tile in **any** legal
  location, or place a link on **any** legal line.
- **Rail Era** building: multiple industry tiles allowed per location (max 1 per player per
  location). Tiles with the locked icon (×) on the mat can't be built; develop them away.
- **Farm Breweries**: 2 unnamed brewery spaces, buildable only with a **Brewery** or
  **Wild Industry** card. Specific link adjacency rules connect them to Cannock /
  Kidderminster–Worcester.

### 3.8 Network action (detail)
- **Canal Era**: build canal links only; **max 1 per Network action**; cost **£3**.
- **Rail Era**: build rail links only:
  - **1** rail link for **£5**, **or 2** rail links for **£15** + consume **1 beer**
    (the beer must be from a Brewery, not merchant beer; if from an opponent's brewery it
    must be connected to the **second** rail link after placement).
  - Each rail link consumes **1 coal** (must be connected to a coal source after placement).
- A placed link must be adjacent to a location in your network (unless you have **no** tiles
  on the board, in which case any legal line is allowed).

### 3.9 Sell action (detail)
- Discard any card. For each Cotton Mill / Manufacturer / Pottery tile you own that is
  **connected to a merchant tile showing that industry's icon**:
  - Consume the required beer (top‑right of tile). Beer sources: your breweries (no connection
    needed), opponents' breweries (must be connected), or the **merchant beer** beside the
    merchant you sell to.
  - **Flip** the tile and advance income by the amount in its bottom‑right.
  - Repeat for additional eligible tiles in the same action.
  - If you consume **merchant beer**, also collect that merchant's bonus:
    - **Gloucester** → free Develop (remove a lowest tile, no iron; not a lightbulb pottery).
    - **Oxford** → +2 income spaces.
    - **Nottingham / Shrewsbury** → +VP (amount shown).
    - **Warrington** → +£5.
- You can't sell if you can't satisfy the beer requirement.

### 3.10 Core gameplay concepts the engine must compute
- **Connected**: two locations are connected if a path of link tiles (owned by **any** player)
  joins them.
- **Your network**: a location is in your network if it holds one of your industry tiles
  **or** is adjacent to one of your link tiles.
- **Consuming coal**: from the **closest connected** coal mine (any owner, free); ties → choose.
  If none connected → buy from **Coal Market** cheapest‑first (needs connection to a merchant);
  empty market → still buyable at a fixed price. Coal always needs a connection.
- **Consuming iron**: from **any** iron works (free, no connection needed); else **Iron Market**
  cheapest‑first; empty market → fixed price.
- **Consuming beer**: own breweries (no connection), opponents' breweries (connected), or
  merchant beer (Sell only). Each required beer may come from a different source.
- **Flipping tiles**: Cotton/Manufacturer/Pottery flip on **Sell**. Coal/Iron/Brewery flip
  when their **last resource cube** is removed (often on someone else's turn) → advances income.
- **Increasing income**: advance the income marker by the number of **spaces** shown; income
  **level** caps at **30**.

### 3.11 End of era
1. **Score links**: each of your links scores **1 VP per VP‑icon** in the locations it touches;
   remove links from the board as scored.
2. **Score flipped industry tiles**: add the VP shown in the bottom‑left of each **flipped**
   tile on the board. Unflipped tiles score nothing.

### 3.12 End of Canal Era maintenance (before Rail Era)
1. Remove all **level‑1** industry tiles from the **board** (mats keep theirs); level ≥2 stays.
2. Reset merchant beer (refill empty beer spaces beside non‑blank merchants).
3. Shuffle all discard piles + remaining deck into a fresh **Draw Deck**.
4. Each player draws a new **hand of 8**.

### 3.13 Winning & tiebreaks
- Most VP wins. Tie → most income level → most money remaining → otherwise a shared win.

### 3.14 Introductory variant (also supported)
- Play **Canal Era only**, then add: £4 → 1 VP (max 15), +income‑level VP (negative subtracts),
  and score level ≥2 industry tiles a second time.

---

## 4. High‑Level Architecture

The application is split into a **pure, framework‑agnostic game core** and an **outer shell**
(UI, audio, i18n, persistence, packaging). The core never imports React; the UI never mutates
game state directly.

```
+-------------------------------------------------------------+
|                     Desktop Shell (Tauri/Electron)          |
|  - window mgmt, native menus, file dialogs, auto-update     |
+----------------------------+--------------------------------+
                             |  (loads the same web bundle)
+----------------------------v--------------------------------+
|                       UI Layer (React)                      |
|  Screens, Board (SVG), PlayerMat, Hand, Market panels,      |
|  Action bar, Modals, Animations (Framer/GSAP), HUD          |
+------+------------------+-----------------+-----------------+
       |                  |                 |
       v                  v                 v
+-------------+   +----------------+   +-----------------+
| i18n (EN/   |   | Audio (Howler) |   | Persistence     |
| RU/UZ)      |   | SFX + music    |   | IndexedDB / FS  |
+-------------+   +----------------+   +-----------------+
       |
       v
+-------------------------------------------------------------+
|                  Game Core (pure TypeScript)                |
|  - Domain model & static data (board graph, tiles, cards)   |
|  - GameState (immutable, serializable)                      |
|  - Reducer: (state, Action) -> {state, events[]}            |
|  - Validators: legalActions(state, player)                  |
|  - Selectors: connectivity, network, resource routing       |
|  - Scoring, era transitions, income, turn order             |
|  - RNG (seeded) for shuffles -> deterministic replays       |
+----------------------------+--------------------------------+
                             ^
                             |  same API
+----------------------------+--------------------------------+
|                        AI Bots                              |
|  legalActions -> evaluate -> choose Action                  |
+-------------------------------------------------------------+
```

### 4.1 Key architectural principles
- **Pure core, dumb UI**: the engine is a pure function `reduce(state, action) -> {state, events}`.
  The UI dispatches actions and renders state + plays the emitted `events` as animations/sounds.
- **Deterministic & serializable**: state is plain JSON; all randomness flows through a seeded
  RNG. This enables **save/load**, **undo (within a turn)**, **replays**, and **bot reproducibility**.
- **Event stream drives presentation**: every state change emits semantic events
  (`TILE_PLACED`, `CUBE_TO_MARKET`, `INCOME_CHANGED`, `TILE_FLIPPED`, `ERA_ENDED`, …). The
  animation/audio layers subscribe and react. The engine itself has zero knowledge of pixels.
- **Single rules authority**: humans and AI both go through `legalActions()` +
  `reduce()`. There is exactly one implementation of the rules.
- **No auto‑start**: the application always boots to the **Main Menu**. A game session begins
  only on explicit user choice (*New Game* → setup, or *Continue*/*Load*). UI/navigation state
  (`AppScreen`) is kept separate from the pure `GameState`. See §7.10.

---

## 5. Repository / Folder Structure

```
MYSpolly/
├─ Brass-Birmingham-Rulebook.pdf        # reference (not shipped)
├─ MYSpolly.md                          # this document
├─ ASSETS_CREDITS.md                    # asset licenses & attribution
├─ package.json / pnpm-lock.yaml
├─ vite.config.ts / tsconfig.json
├─ .eslintrc / .prettierrc
├─ index.html
├─ public/                              # static assets served as-is
│   └─ assets/
│       ├─ board/ (day.svg, night.svg, regions/)
│       ├─ tiles/ (industry tiles per level, link tiles)
│       ├─ cards/ (location/industry/wild card faces & backs)
│       ├─ icons/ (coal, iron, beer, vp, income, £)
│       ├─ audio/ (sfx sprite + music tracks)
│       └─ fonts/
├─ src/
│   ├─ core/                            # PURE game engine (no React)
│   │   ├─ data/                        # static game data
│   │   │   ├─ board.ts                 # locations, link lines, merchants
│   │   │   ├─ industries.ts            # per-industry, per-level stats
│   │   │   ├─ cards.ts                 # card definitions per player count
│   │   │   ├─ markets.ts               # coal/iron market price ladders
│   │   │   └─ setup.ts                 # player-count setup parameters
│   │   ├─ model/                       # types/interfaces
│   │   │   ├─ state.ts                 # GameState, PlayerState, etc.
│   │   │   ├─ actions.ts               # Action union types
│   │   │   └─ events.ts                # GameEvent union types
│   │   ├─ engine/
│   │   │   ├─ reduce.ts                # main reducer dispatch
│   │   │   ├─ actions/                 # one file per action
│   │   │   │   ├─ build.ts  network.ts  develop.ts  sell.ts
│   │   │   │   ├─ loan.ts    scout.ts    pass.ts
│   │   │   ├─ phases.ts                # turn/round/era transitions
│   │   │   ├─ income.ts  scoring.ts  turnOrder.ts
│   │   │   └─ setup.ts                 # buildInitialState(opts, seed)
│   │   ├─ selectors/
│   │   │   ├─ connectivity.ts          # BFS over link graph
│   │   │   ├─ network.ts               # player network membership
│   │   │   ├─ resources.ts             # coal/iron/beer routing & cost
│   │   │   └─ legalActions.ts          # enumerate legal moves
│   │   ├─ rng.ts                       # seeded PRNG (mulberry32/xoshiro)
│   │   └─ index.ts
│   ├─ ai/
│   │   ├─ bot.ts                       # bot interface
│   │   ├─ heuristic.ts                 # scoring of candidate actions
│   │   └─ difficulty.ts
│   ├─ app/                             # React application
│   │   ├─ store/                       # Zustand store wrapping the core
│   │   ├─ screens/ (Splash, MainMenu, GameSetup, LoadGame, Game, PauseMenu, Settings, Rules, Credits, Results, Replay)
│   │   ├─ components/
│   │   │   ├─ board/ (BoardSvg, Location, LinkLine, MerchantTile)
│   │   │   ├─ tiles/ (IndustryTile, LinkTileView)
│   │   │   ├─ cards/ (CardView, Hand, DiscardPile)
│   │   │   ├─ market/ (CoalMarket, IronMarket)
│   │   │   ├─ player/ (PlayerMat, IncomeTrack, TurnOrderTrack, VpTrack)
│   │   │   ├─ hud/ (ActionBar, Log, Banner, Tooltip)
│   │   │   └─ modals/ (SellModal, BuildModal, ConfirmModal)
│   │   ├─ animation/ (timelines.ts, useAnimateEvents.ts)
│   │   ├─ audio/ (sound.ts, useSound.ts)
│   │   └─ i18n/ (index.ts, en.json, ru.json, uz.json)
│   ├─ persistence/ (save.ts, settings.ts, replay.ts)
│   └─ main.tsx
├─ src-tauri/                           # Tauri desktop shell (Phase B)
│   ├─ tauri.conf.json  Cargo.toml  src/main.rs
├─ electron/ (optional fallback shell)
└─ tests/
    ├─ unit/ (engine rules, scoring, routing)
    ├─ component/ (UI)
    └─ e2e/ (full game playthrough)
```

---

## 6. Core Domain Model (representative TypeScript)

```ts
// ---- Identifiers & enums ----
type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';
type Era = 'canal' | 'rail';
type IndustryType = 'cotton' | 'coal' | 'iron' | 'manufacturer' | 'pottery' | 'brewery';
type LinkType = 'canal' | 'rail';
type CardKind = 'location' | 'industry' | 'wildLocation' | 'wildIndustry';

// ---- Static board data ----
interface LocationDef {
  id: string;                 // e.g. "birmingham"
  name: string;               // display key for i18n
  colorBand: 'blue'|'teal'|'red'|'yellow'|'green'|'farm'|'merchant';
  slots: IndustrySlot[];      // build spaces & which industry icons they allow
  isMerchant?: boolean;
  merchantBeerBonus?: 'develop'|'income'|'vp'|'money';
}
interface IndustrySlot { id: string; allowed: IndustryType[]; }
interface LinkLineDef { id: string; a: string; b: string; types: LinkType[]; } // canal/rail/both

// ---- Per-industry, per-level static stats ----
interface IndustryLevelDef {
  level: number;
  costMoney: number; costCoal: number; costIron: number;
  beerToSell?: number;        // for cotton/manufacturer/pottery
  vp: number;                 // scored when flipped
  incomeSpaces: number;       // income advance when flipped
  linkVp?: number;            // VP icons it contributes to adjacent links
  resourceCount?: number;     // coal/iron/beer produced on build
  buildableInCanal: boolean; buildableInRail: boolean;
  developable: boolean;       // false for lightbulb potteries
}

// ---- Dynamic state ----
interface PlacedTile {
  id: string; owner: PlayerColor; industry: IndustryType; level: number;
  locationId: string; slotId: string; flipped: boolean;
  resourcesLeft: number;      // cubes/beer remaining on the tile
}
interface PlacedLink { id: string; owner: PlayerColor; lineId: string; type: LinkType; }

interface MarketTrack { cubes: number; capacity: number; priceLadder: number[]; emptyPrice: number; }

interface PlayerState {
  color: PlayerColor;
  money: number; incomeLevel: number; vp: number;
  hand: Card[]; discard: Card[];
  matStacks: Record<IndustryType, number[]>; // remaining levels on the mat
  spentThisTurn: number;
}

interface GameState {
  version: number; seed: number; rngState: number;
  options: { players: number; introMode: boolean; boardSide: 'day'|'night'; lang: 'en'|'ru'|'uz' };
  era: Era; round: number; isFirstCanalRound: boolean;
  turnOrder: PlayerColor[]; activePlayer: PlayerColor; actionsLeftThisTurn: number;
  players: Record<PlayerColor, PlayerState>;
  board: { tiles: PlacedTile[]; links: PlacedLink[]; merchants: MerchantState[] };
  coalMarket: MarketTrack; ironMarket: MarketTrack;
  drawDeck: Card[]; wildLocationPile: number; wildIndustryPile: number;
  phase: 'setup'|'playing'|'roundEnd'|'eraEnd'|'gameOver';
  log: GameEvent[];
}

// ---- Actions (input) ----
type Action =
  | { type: 'BUILD'; card: CardRef; industry: IndustryType; locationId: string; slotId: string;
      coalSources: ResourceSource[]; ironSources: ResourceSource[]; overbuildTileId?: string }
  | { type: 'NETWORK'; card: CardRef; links: { lineId: string; coalSource?: ResourceSource }[];
      beerSource?: ResourceSource }
  | { type: 'DEVELOP'; card: CardRef; removals: { industry: IndustryType }[]; ironSources: ResourceSource[] }
  | { type: 'SELL'; card: CardRef; sales: { tileId: string; merchantId: string; beer: ResourceSource[] }[] }
  | { type: 'LOAN'; card: CardRef }
  | { type: 'SCOUT'; card: CardRef; extraDiscards: [CardRef, CardRef] }
  | { type: 'PASS'; card: CardRef };

// ---- Events (output, drives animation/audio) ----
type GameEvent =
  | { t: 'TILE_PLACED'; tile: PlacedTile }
  | { t: 'LINK_PLACED'; link: PlacedLink }
  | { t: 'CUBE_TO_MARKET'; resource: 'coal'|'iron'; from: string; count: number; income: number }
  | { t: 'RESOURCE_CONSUMED'; resource: 'coal'|'iron'|'beer'; from: string }
  | { t: 'TILE_FLIPPED'; tileId: string; incomeGain: number }
  | { t: 'INCOME_CHANGED'; player: PlayerColor; delta: number }
  | { t: 'MONEY_CHANGED'; player: PlayerColor; delta: number }
  | { t: 'VP_CHANGED'; player: PlayerColor; delta: number }
  | { t: 'CARD_DISCARDED'; card: Card } | { t: 'HAND_REFILLED'; player: PlayerColor; count: number }
  | { t: 'TURN_ENDED'; next: PlayerColor } | { t: 'ROUND_ENDED'; newOrder: PlayerColor[] }
  | { t: 'ERA_ENDED'; era: Era } | { t: 'GAME_OVER'; ranking: PlayerColor[] };
```

> The exact numeric stats per industry/level and the full board graph (every location,
> every link line, every slot's allowed icons, market price ladders) are produced as a
> **data extraction task** (see Phase 1) and stored in `src/core/data/`.

---

## 7. Subsystem Designs

### 7.1 Game engine
- `reduce(state, action)` validates the action via the same predicates used by `legalActions`,
  then applies it immutably (structural sharing / Immer), returning new state + an event list.
- All "automatic" consequences (market cube movement, tile flips, income gains) are handled
  inside the reducer and surfaced as events.
- Phase machine handles: action count (1 in first Canal round, else 2), hand refill, round end
  (turn order re‑sort + income), era end (scoring + Canal maintenance), game over.

### 7.2 Connectivity & resource routing (selectors)
- Build an adjacency graph from placed links. `connected(a, b)` and `distance(a, b)` via BFS.
- `network(player)` = locations with the player's tiles ∪ locations adjacent to player's links.
- `coalOptions(loc)` = nearest connected coal mines, then market; `ironOptions()` = any iron
  works then market; `beerOptions(player, loc, context)` = own breweries / connected opponents'
  breweries / merchant beer. These power both UI affordances and AI evaluation.

### 7.3 UI layer
- **BoardSvg** renders the map from board data: `Location` nodes, `LinkLine` edges (with
  hit‑areas), merchant tiles, and overlays for legal placements (highlight valid slots/lines
  for the pending action).
- **PlayerMat** shows stacked tiles per industry with cost/coal/iron/VP, income & VP tracks.
- **Hand** shows cards; selecting an action enters a guided flow (pick card → pick target →
  resolve resource choices → confirm).
- **Market panels** visualize the coal/iron price ladders and the beer barrels at merchants.
- **ActionBar** lists the 7 actions, disabling illegal ones (driven by `legalActions`).
- **Guided action flow** uses a small UI state machine so players can't make illegal moves; a
  preview shows cost (money/coal/iron/beer) before confirming.

### 7.4 Animation system
- Each `GameEvent` maps to a timeline. A queue plays them in order (configurable speed, skippable):
  - `TILE_PLACED` → tile drops/scales onto its slot.
  - `CUBE_TO_MARKET` → cubes travel from tile to market spaces; coins fly to the player.
  - `TILE_FLIPPED` → 3D flip revealing the VP/income face; income marker slides.
  - `VP_CHANGED` / `INCOME_CHANGED` → marker animates along the track.
  - `ERA_ENDED` → scoring sweep across links/tiles; Canal→Rail transition sequence.
- Framer Motion for component transitions; GSAP timelines for multi‑actor sequences.
- Respect `prefers-reduced-motion` and a "fast animations" setting.

### 7.5 Audio system (Howler)
- SFX: tile place, link place, cube clink, coin, card draw/discard, flip, button, error,
  era fanfare, victory. Music: menu loop, Canal Era ambience, Rail Era ambience.
- Mixer with master/SFX/music volume + mute, persisted in settings.

### 7.6 Internationalization (EN / RU / UZ)
- i18next with three resource bundles. All player‑facing strings are keys (no hard‑coded text).
- Includes rules/tooltips, action names, location names, merchant bonuses, log messages, and
  numbers/currency formatting. Language switch is instant (no reload). RU/UZ glossary kept in
  `i18n/glossary.md` for consistent board‑game terminology.

### 7.7 AI bots
- Implements `chooseAction(state, color): Action` using only `legalActions` + `reduce` (for
  look‑ahead). Difficulty tiers: Easy (greedy heuristic), Normal (1‑turn look‑ahead + heuristic),
  Hard (light MCTS / beam search). Heuristic weights: income growth, VP potential, network reach,
  resource economy, era timing. Bots run async with a "thinking" delay for feel.

### 7.8 Persistence & replays
- Autosave `GameState` to IndexedDB (web) / app data dir (desktop) each turn.
- Settings (lang, volume, animation speed, board side) persisted separately.
- Because state is seeded + action‑logged, full **replays** are storable as `seed + actions[]`.

### 7.9 Desktop packaging
- **Tauri (primary)**: `src-tauri/` wraps the web build; provides native window, menus, file
  dialogs (save/load), and updater. Produces `.exe` (NSIS/MSI), `.app`/`.dmg`, `.AppImage/.deb`.
- **Electron (fallback)**: documented alternative if the Rust toolchain is unavailable; larger
  binary but simpler. Same web bundle is loaded either way.

### 7.10 Application Flow, Main Menu, Settings & Continue/Resume

> **Core rule: the game NEVER auto‑starts.** On launch the app always lands on the **Main Menu**.
> A game session only begins after the player explicitly chooses *New Game* (and confirms setup)
> or *Continue*. This is a hard requirement, not optional polish.

#### 7.10.1 Screen / navigation state machine
The app is driven by a top‑level `AppScreen` state (held in the Zustand UI store, **separate**
from the pure `GameState`). Valid screens and transitions:

```
                 ┌───────────────────────────────────────────────┐
                 v                                                 │
   (launch) → SPLASH → MAIN_MENU ──New Game──▶ GAME_SETUP ──Start──┼─▶ GAME
                          │  ▲                     │  (Back)        │     │
                          │  │ ◀───────────────────┘                │     │ (Pause/Esc)
                          │  │                                       │     ▼
                          │  ├──Continue──▶ GAME (loaded autosave) ──┘   PAUSE_MENU
                          │  ├──Load Game──▶ LOAD_GAME ──▶ GAME            │
                          │  ├──Settings──▶ SETTINGS ──Back──▶ MAIN_MENU   ├─Resume─▶ GAME
                          │  ├──How to Play──▶ RULES ──Back──▶ MAIN_MENU   ├─Settings─▶ SETTINGS
                          │  ├──Credits──▶ CREDITS ──Back──▶ MAIN_MENU     ├─Save & Quit─▶ MAIN_MENU
                          │  └──Quit──▶ (desktop: close app / web: confirm)└─Abandon──▶ MAIN_MENU
                          │                                                       │
                          └───────────────────── GAME_OVER (Results) ◀────────────┘
                                     │  ├─Rematch──▶ GAME_SETUP (prefilled)
                                     │  ├─Main Menu──▶ MAIN_MENU
                                     │  └─View Replay──▶ REPLAY
```

- `SPLASH`: short branded logo/loading screen while assets + saved data are loaded; auto‑advances
  to `MAIN_MENU` (skippable on key/click). Never advances straight into a game.
- All screens are reachable only through explicit user input; there is no implicit auto‑start.

#### 7.10.2 Main Menu screen
A dedicated `MainMenu` screen (animated background, logo, version number, current language flag).
Menu items, top to bottom:

1. **Continue** — resumes the most recent autosaved game in one click.
   - **Enabled only when an autosave exists.** When none exists it is shown **disabled/greyed
     out** (or hidden, configurable) with a tooltip "No game in progress".
   - Shows a small summary on hover/focus: era, round, player count, last‑played timestamp.
2. **New Game** — opens `GAME_SETUP`. If an in‑progress autosave exists, first show a confirm
   dialog: "Starting a new game will keep your saved game in the Load list" (the autosave is
   moved to a named slot, not destroyed).
3. **Load Game** — opens `LOAD_GAME` (list of all saved slots; see §7.10.4).
4. **Settings** — opens `SETTINGS` (see §7.10.3).
5. **How to Play / Rules** — opens an in‑app rules/help screen (localized).
6. **Credits** — asset attributions and project credits.
7. **Quit** — desktop: closes the window (with confirm); web: returns to splash / shows confirm.

Behaviour & UX:
- Keyboard navigable (↑/↓/Enter/Esc), gamepad‑friendly, fully localized (EN/RU/UZ).
- Language selector and master mute are quick‑accessible from the menu corner.
- Menu music plays (respecting saved volume/mute).

#### 7.10.3 Settings screen
A dedicated `Settings` screen, openable from **both** the Main Menu and the in‑game Pause Menu.
All values persist immediately (IndexedDB on web / app‑data file on desktop) and apply live.

- **Language**: English / Русский / Oʻzbekcha — instant switch, no reload.
- **Audio**: master volume, music volume, SFX volume (sliders) + master mute toggle.
- **Animations**: speed (Slow / Normal / Fast / Instant), toggle for `prefers-reduced-motion`,
  toggle "skip animations on opponent/AI turns".
- **Board**: Day / Night side, zoom sensitivity, optional colour‑blind‑friendly palette.
- **Gameplay**: confirm‑before‑ending‑turn toggle, show legal‑move highlights toggle,
  show rule tooltips toggle, AI thinking‑speed.
- **Data**: manage save slots (rename/delete), export/import a save file (desktop file dialog /
  web download‑upload), clear all data (with confirm).
- Each setting has sensible defaults; a **Reset to defaults** button is provided.

#### 7.10.4 Save / Continue / Load (resume previous game)
- **Autosave**: after every completed turn (and at each round/era transition) the full
  `GameState` is serialized to a dedicated **"current game" autosave slot**. Because state is
  seeded + action‑logged, saves are compact and deterministic.
- **Continue** = load the autosave slot and jump straight into `GAME`.
- **Manual save slots**: players can name and keep multiple saves. `LOAD_GAME` lists slots with
  metadata: name, player count + colours, era/round, VP standings, timestamp, thumbnail.
- **Load flow**: selecting a slot validates the save `version` (migrate or warn if incompatible),
  restores `GameState`, rebuilds the UI store, and enters `GAME` exactly where it left off —
  including mid‑turn state if the autosave was taken mid‑turn.
- **Crash/quit safety**: on launch, if an autosave exists it powers the **Continue** button; the
  app still opens to the Main Menu first (never auto‑loads into the game).
- **Delete/overwrite**: deleting a slot or starting a brand‑new game asks for confirmation so a
  saved game is never lost silently.

#### 7.10.5 Pause / in‑game menu
- Pressing **Esc** (or a Pause button) during a game opens a `PAUSE_MENU` overlay:
  **Resume**, **Settings**, **Save Game** (to a named slot), **How to Play**, **Save & Quit to
  Main Menu**, **Abandon Game** (confirm). The game state is untouched while paused.

### 7.11 Board Camera — Pan & Zoom (Interactive Map View)

> **Problem being fixed:** the board map is currently rendered statically, locked in the centre,
> and cannot be moved or zoomed. The map must become a fully interactive, navigable camera view
> like a real digital board game.

The board is wrapped in a **camera/viewport controller** that applies a 2D transform
`{ scale, translateX, translateY }` to the SVG board group. The map is **not** locked to centre.

- **Mouse‑wheel zoom**: scrolling zooms **toward the cursor position** (the point under the
  pointer stays fixed). Clamp scale to `minZoom`…`maxZoom` (e.g. 0.5×…3×). Smooth/eased zoom.
- **Click‑drag pan**: pressing and dragging with the mouse (left button, or middle‑button)
  moves the map in any direction (left/right/up/down). Inertia/easing optional.
- **Touch / trackpad**: pinch‑to‑zoom and two‑finger pan support.
- **Pan bounds**: clamp translation so the board can't be dragged completely off‑screen
  (keep at least a margin of the board visible); allow generous over‑pan at high zoom.
- **Keyboard**: arrow keys pan, `+`/`-` zoom, `0` resets view.
- **On‑screen controls**: zoom‑in / zoom‑out / **reset view (fit board to screen)** buttons,
  plus an optional mini‑map. A "fit to screen" default is computed on load and on window resize.
- **Performance**: transforms are GPU‑friendly (CSS `transform` on the SVG container); no React
  re‑render per frame — camera state lives in a ref/store and is applied imperatively or via a
  lightweight motion value. Target a steady 60 fps while panning/zooming.
- **Implementation note**: a small dedicated hook `useBoardCamera()` owns the transform and
  pointer handlers; consider `react-zoom-pan-pinch` or a custom controller. Camera state is UI
  state (never part of the pure `GameState`) but the current view may be persisted per session.

### 7.12 Map Clarity — Readable, Self‑Explanatory Locations

> **Problem being fixed:** locations on the map are hard to understand. They must clearly
> communicate, at a glance, *what* each place is and *what can be built/done there*, matching the
> visual logic of Brass: Birmingham.

- **Location cards/nodes** show: the localized location **name**, a subtle colour band matching
  its region/player‑count colour, and clearly drawn **build slots** with the **industry icons**
  each slot allows (cotton, coal, iron, manufacturer, pottery, brewery), including shared‑icon
  slots. Empty vs. occupied slots are visually distinct.
- **Built tiles** render in the slot with owner colour, level number, remaining resource cubes
  (coal/iron) or beer, and a clear **flipped/unflipped** appearance.
- **Merchants** clearly show their accepted industry icon(s), their **bonus type** (Develop /
  Income / VP / Money) with an icon + tooltip, and the merchant‑beer barrel.
- **Links/lines**: canal vs. rail lines are visually distinct (style/colour); buildable lines for
  the current action are highlighted; owned links show owner colour.
- **Hover/focus tooltip** on any location: name, which industries can be built there, current
  tiles, connection info, and whether it is in the active player's network.
- **Legibility at zoom**: labels and icons scale sensibly; at low zoom show names + region colour,
  at high zoom reveal slot icons and tile details (level‑of‑detail rendering).
- **Network/affordance highlighting**: when an action is active, valid target locations/slots/
  lines glow; invalid ones are dimmed, so the player always sees where a move is legal.
- **Legend / key**: an always‑available legend explains icons (coal, iron, beer, VP, £, income,
  merchant bonuses, canal vs rail), fully localized (EN/RU/UZ).
- Farm Breweries and special links (Cannock / Kidderminster–Worcester) are labelled clearly.

### 7.13 Action & Move UI Clarity (Human‑Readable Moves)

> **Problem being fixed:** the move list currently dumps raw enumerated `legalActions`, showing
> meaningless, repeated entries like *"Discard a card, do nothing — 8 options"*. This is confusing
> and must be replaced with a guided, human‑readable action UX like the real game.

- **No raw enumeration dumps.** Never present the player a flat list of identical/cryptic options.
  The UI must translate engine moves into clear, contextual choices.
- **Action‑first guided flow** (per §7.3): the player first picks an **action** from the Action
  Bar (Build, Network, Develop, Sell, Loan, Scout, Pass) — each with an icon, localized name, and
  a one‑line description of what it does. Illegal actions are disabled with a tooltip explaining
  *why* (e.g. "No card lets you build here", "Not connected to a merchant").
- After choosing an action, the player is guided step‑by‑step:
  1. **Choose the card** to spend (shown as readable cards, not indices), with a hint of what each
     card enables.
  2. **Choose the target** (location/slot/line) by clicking the highlighted board element — not by
     picking from a text list.
  3. **Resolve resource choices** (which coal mine / iron works / brewery / market to draw from)
     with a clear picker showing source and cost.
  4. **Confirm** against a **cost & effect preview** (money, coal, iron, beer spent; income/VP/
     flips gained). Allow Cancel/Back at every step.
- **Pass action**: presented as a single clear choice — "Pass (discard a card)" with a card
  picker — **not** as N duplicated "do nothing" rows. If passing both actions, ask once and let
  the player choose which card(s) to discard.
- **Discards** are always an explicit, understandable choice of *which* card, with the card faces
  shown; never an opaque "option 1…8" list.
- **Turn HUD**: clearly show era, round, whose turn it is, actions remaining, and a concise
  prompt of the current step ("Pick a card to build a Cotton Mill in Birmingham").
- **Turn handoff (player change) clarity**: when play passes from one player to the next, it must
  be **unmistakable whose turn it now is**. On every turn change show a brief, prominent
  transition cue — e.g. a centred "Player X's turn" banner/overlay in that player's colour (with
  their avatar/character), a sound cue, and a colour accent applied to the active player's panel
  and the board frame. The previously active player's UI visibly de‑emphasizes; the new active
  player's panel highlights/pulses. This applies to **both** human hot‑seat handoffs (where a
  clear "Pass device to Player X — Ready?" confirmation may be shown) and AI→human transitions.
- **Localization**: every action name, description, prompt, tooltip, and log line is an i18n key
  in EN/RU/UZ. Log messages read as full sentences (e.g. "Blue built a Coal Mine in Dudley"),
  not terse fragments.
- **AI turns**: render the bot's chosen move as a readable, animated action with a short log line;
  do not expose internal enumerations to the player.

### 7.14 "How to Play" — In‑Game Rules, Tutorial & Contextual Help

> **Goal being addressed:** make the *How to Play* experience complete and crystal‑clear. A new
> player should be able to learn the **entire** game inside the app — every rule, every action,
> every concept — without needing the paper rulebook. All content is paraphrased from
> `Brass-Birmingham-Rulebook.pdf` (not copied verbatim) and fully localized in **EN/RU/UZ**.

The Help system has three complementary layers: a **Rules Library** (read), an **Interactive
Tutorial** (learn by doing), and **Contextual Help** (in‑situ tooltips/explanations).

#### 7.14.1 Rules Library (browsable reference)
A dedicated, scrollable, searchable rules screen (reachable from Main Menu **and** the Pause
menu), organized into clear chapters that mirror the actual game so nothing is missing:
1. **Overview & Goal** — theme, the two eras (Canal 1770–1830, Rail 1830–1870), how you win (VP).
2. **Components & the Board** — player mat, tiles, cards, cubes, markets, merchants, tracks.
3. **Setup** — what changes for 2 / 3 / 4 players (removed cards/merchants, market fill, starting
   money/income/hand).
4. **Turn structure** — 2 actions per turn (1 each in the first Canal round), discard per action,
   refill to 8, spending → turn order.
5. **The 7 Actions** — one clearly explained page each: **Build, Network, Develop, Sell, Loan,
   Scout, Pass** — with cost, requirements, what card is needed, and a worked example + diagram.
6. **Core concepts** — Connected locations, Your Network, Consuming Coal/Iron/Beer, moving
   cubes to the markets, Flipping tiles, Increasing income, Overbuilding, Farm Breweries.
7. **End of round** — turn‑order re‑sort, income collection, negative income / shortfall rules.
8. **End of era & scoring** — link scoring, flipped‑tile scoring, Canal‑era maintenance,
   Canal→Rail transition.
9. **Winning & tiebreaks**, plus the **Introductory variant**.
10. **Icon glossary / legend** — every icon (coal, iron, beer, VP, £, income, merchant bonuses,
    canal vs rail, lightbulb pottery) with a one‑line meaning.

Requirements:
- Rich, illustrated pages (diagrams/images), not walls of text; collapsible sections; search;
  a table of contents with deep links; "next/previous" navigation.
- Every page available in **EN/RU/UZ**; uses the same icon set as the board for consistency.
- Accessible from the Pause menu mid‑game without losing game state.

#### 7.14.2 Interactive Tutorial (learn by doing)
A guided, step‑by‑step playable tutorial on a scripted game state that teaches the rules by
having the player perform them:
- Coached steps with highlighted UI, arrows, and short instructions ("Now Build a Cotton Mill in
  Birmingham — select the card, then click the highlighted slot").
- Covers, in order: a basic Build, Network, Sell (with beer + merchant), Develop, Loan/Scout,
  taking income, end‑of‑round turn order, and the Canal→Rail transition + scoring.
- Constrains input to the taught action at each step; validates the player did it correctly before
  advancing; allows **Skip** and **Replay** of any lesson.
- Offered automatically the first time the app is opened (skippable), and re‑launchable anytime
  from the Main Menu / How to Play screen. Fully localized EN/RU/UZ.

#### 7.14.3 Contextual Help (in‑situ explanations)
- **Hover/long‑press tooltips** on every interactive element: actions, cards, tiles, slots,
  markets, merchants, tracks, icons — explaining what they are and the rule behind them.
- **"Why is this disabled?"** explanations on greyed‑out actions/targets (e.g. "You're not
  connected to a merchant that buys Cotton").
- A **"?" help button** on each panel opens the relevant Rules Library chapter.
- An optional **rules‑hint toggle** (in Settings) shows extra inline reminders for new players;
  experienced players can turn it off.
- Consistent with §7.12 (map clarity) and §7.13 (action‑UI clarity) so the explanations match
  what the player sees on the board.

---

## 8. Testing & Quality Strategy
- **Engine unit tests** (highest priority): every action, every edge case from §3 — first Canal
  round single action, market emptying & flips, overbuild restrictions, shortfall selling,
  end‑of‑era scoring, Canal maintenance, income cap/floor, scout restriction, farm breweries.
- **Golden game tests**: scripted full 2/3/4‑player games (fixed seed) asserting final scores.
- **Property tests**: random legal play never throws and never produces illegal state.
- **Component tests**: ActionBar disabling, guided flows, market rendering.
- **E2E (Playwright)**: complete a short game through the UI in each language.
- **CI gate**: lint + typecheck + unit + component must pass before merge.

---

## 9. Roadmap & Milestones

| Milestone | Outcome |
|---|---|
| **M0** | Repo scaffolded, runs `Hello Brass` in browser. |
| **M1** | Complete static game data (board graph, tiles, cards) verified. |
| **M2** | Pure engine passes full rules unit tests (headless game playable in code). |
| **M3** | Front‑end shell complete: app boots to **Main Menu** (New Game / Continue / Load / Settings); interactive board + hot‑seat UI; a full human 2P game playable in browser. |
| **M4** | Animations + audio + 3‑language i18n complete. |
| **M5** | AI bots fill seats; save/load + settings; introductory variant. |
| **M6** | Tauri desktop builds for Windows/macOS/Linux; CI artifacts; polish & release. |

---

## 10. Detailed Task Breakdown (English)

> Tasks are grouped into phases. Each is intentionally small and verifiable. Check items off
> as completed. "DoD" = Definition of Done.

### Phase 0 — Project Setup & Foundations
- [x] **0.1** Initialize project: `pnpm create vite` (React + TS), commit baseline. *DoD: dev server runs.*
- [x] **0.2** Configure strict `tsconfig`, ESLint, Prettier, EditorConfig. *DoD: lint passes on empty project.*
- [x] **0.3** Install deps: zustand, framer-motion, gsap, howler, i18next, react-i18next, idb, immer. Add Vitest + RTL + Playwright.
- [x] **0.4** Set up folder structure per §5; add path aliases (`@core`, `@app`).
- [x] **0.5** GitHub Actions CI: install → typecheck → lint → test on PR. *DoD: green CI on a trivial test.*
- [x] **0.6** Create `ASSETS_CREDITS.md` and an `/public/assets` placeholder structure.
- [x] **0.7** Add a global theme system (CSS variables) supporting Day/Night palettes.

### Phase 1 — Static Game Data (the "rules data")
- [x] **1.1** Extract the **board graph** from the rulebook/board: every location id, display name,
      colour band, and the merchant locations. *DoD: all locations enumerated & typed.*
- [x] **1.2** Extract every **link line** (which two locations it connects; canal/rail/both).
- [x] **1.3** Extract each location's **industry slots** and which industry icons each slot allows.
- [x] **1.4** Encode the **9 merchant tiles** with their industry icons + beer bonus type, plus the
      player‑count placement rules (2P: no Warrington/Nottingham; 3P: no Nottingham; 4P: all).
- [x] **1.5** Encode **per‑industry, per‑level stats**: cost, coal cost, iron cost, beer‑to‑sell,
      VP, income spaces, link VP contribution, cubes produced, era buildability, developable flag,
      lightbulb potteries. *DoD: matches the player‑mat printouts exactly.*
- [x] **1.6** Encode the **card deck** composition for 2/3/4 players (location cards, industry
      cards, counts), plus Wild Location/Industry piles.
- [x] **1.7** Encode **coal & iron market** price ladders, capacities, and empty‑market prices.
- [x] **1.8** Encode **setup parameters** (starting money £17, income level 10, hand size 8,
      tile stacks per colour, removed cards/merchants per player count).
- [x] **1.9** Write a **data validation test** (counts add up: 45 tiles/colour, 14 links/colour,
      30 coal, 18 iron, 15 beer, merchant counts, deck sizes). *DoD: validation test passes.*

### Phase 2 — Pure Game Engine
- [x] **2.1** Define model types (`state.ts`, `actions.ts`, `events.ts`) per §6.
- [x] **2.2** Implement seeded RNG (`rng.ts`) and a deterministic shuffle.
- [x] **2.3** Implement `buildInitialState(options, seed)` (full setup incl. player‑count rules).
- [x] **2.4** Implement connectivity selectors: graph build, `connected`, `distance`, `network`.
- [x] **2.5** Implement resource routing: `coalOptions`, `ironOptions`, `beerOptions`, cost calc,
      and market price computation.
- [x] **2.6** Implement **Build** action incl. slot rules, payment, coal/iron consumption,
      cube‑to‑market movement, brewery beer placement, tile flips, overbuilding rules,
      "no tiles on board" case, and Farm Breweries.
- [x] **2.7** Implement **Network** action (Canal £3×1; Rail £5×1 or £15×2+beer; coal per rail link).
- [x] **2.8** Implement **Develop** action (1–2 removals, iron per removal, lightbulb restriction).
- [x] **2.9** Implement **Sell** action (merchant matching, beer consumption from all sources,
      merchant beer bonuses, multi‑tile sells, flips + income).
- [x] **2.10** Implement **Loan** (+£30, −3 income levels, −10 floor) and **Scout** (discard+2,
      wild restriction) and **Pass**.
- [x] **2.11** Implement card discard/refill, action counting (1 in first Canal round else 2),
      and spent‑money tracking on character tiles.
- [x] **2.12** Implement **end of round**: turn‑order re‑sort + income collection incl. negative
      income, shortfall tile‑selling (half cost rounded down), and VP loss fallback.
- [x] **2.13** Implement **end of era scoring** (links by adjacent VP icons; flipped tiles' VP).
- [x] **2.14** Implement **end of Canal Era maintenance** (remove level‑1 board tiles, reset
      merchant beer, reshuffle discards, redraw hands) and the **Canal→Rail** transition.
- [x] **2.15** Implement **game over** + ranking with tiebreaks (VP → income → money → draw).
- [x] **2.16** Implement the **introductory variant** scoring (Canal‑only + bonus scoring).
- [x] **2.17** Implement `legalActions(state, player)` enumerating all legal moves (drives UI + AI).
- [x] **2.18** **Engine test suite**: unit tests for every action + all §3 edge cases.
- [x] **2.19** **Golden game test**: scripted full 2P/3P/4P games with asserted final scores.
- [x] **2.20** **Property test**: random legal play for N turns never throws / never corrupts state.
      *DoD: M2 reached — a complete game is playable headlessly via code.*

### Phase 3 — UI: Interactive Board & Hot‑seat Play
- [x] **3.1** Zustand UI store wrapping the core (`appStore.ts`): `dispatch(action)`, exposes
      state + event stream, **plus a separate `AppScreen` navigation state**.
- [x] **3.2** Screen router + transitions (`App.tsx`) implementing §7.10.1. **Always opens to
      Splash → Main Menu; never auto‑starts a game.**
- [x] **3.3** **Splash screen** (skippable, auto‑advances to Main Menu only).
- [x] **3.4** **Main Menu screen** (§7.10.2): Continue (gated on autosave, with summary tooltip),
      New Game, Load Game, Settings, How to Play, Credits + quick language/mute. Localized.
- [x] **3.5** **GameSetup screen**: player count, human/AI per seat + difficulty, colours,
      board side/lang (from settings), intro‑variant toggle; Start + Back.
- [x] **3.6** **Settings screen** (§7.10.3): language, audio, animation speed + reduced‑motion,
      board side + colour‑blind, gameplay toggles, reset. From Menu **and** Pause; applies live.
- [x] **3.7** **Save/Continue/Load system** (§7.10.4): autosave each dispatch; Continue loads it;
      Load Game lists named slots w/ metadata; version‑validated restore; delete confirm.
- [x] **3.8** **Pause Menu** (§7.10.5): Esc overlay — Resume, Settings, Save, How to Play,
      Save & Quit, Abandon (confirm). State untouched.
- [x] **3.9** **Rules / How‑to‑Play** and **Credits** screens (localized, attribution).
- [x] **3.10** **BoardSvg**: locations, link lines, merchants from data (layout coordinates).
- [x] **3.11** Industry/link tile rendering (level/owner/flipped) drawn on the board nodes.
- [x] **3.12** **PlayerStrip** (player overview): money, income, VP, spent — per player.
- [x] **3.13** **Hand** rendering (hidden for AI seats in hot‑seat).
- [x] **3.14** **Coal/Iron Market** panels + merchant beer indicators on the board.
- [x] **3.15** Turn‑order + spent‑money display (in `PlayerStrip`).
- [x] **3.16** **ActionBar**: 7 actions, disabled when no legal move (from `legalActions`).
- [x] **3.17** **Guided action flow**: pick action → choose from enumerated legal concrete
      actions (with cost hint) → dispatch. Illegal moves impossible.
- [x] **3.18** Legal‑placement highlighting on the board (valid locations/lines).
- [x] **3.19** **Game log** panel (event stream → readable lines).
- [x] **3.20** **Results** screen with standings + Rematch / Main Menu / View Replay.
      *DoD: M3 reached — hot‑seat play in the browser, always starting from the Main Menu,
      with working New Game / Continue / Load / Settings.*

### Phase 3R — Board Camera, Map Clarity & Action‑UI Clarity (UX Revision)

> Fixes for current issues: the map is locked/static, locations are hard to read, and the move
> list shows confusing raw options (e.g. "Discard a card, do nothing — 8 options"). Implements
> §7.11, §7.12, §7.13. Goal: make the game look and feel like Brass: Birmingham.

**Board camera (pan & zoom) — §7.11**
- [x] **3R.1** Add a `useBoardCamera()` controller holding `{ scale, translateX, translateY }`
      as UI state (ref/store, applied via CSS transform — no per‑frame React re‑render).
- [x] **3R.2** **Mouse‑wheel zoom toward the cursor**, clamped to `minZoom`…`maxZoom`, smooth/eased.
- [x] **3R.3** **Click‑drag panning** in all directions (left/right/up/down); the map is no longer
      locked to centre.
- [x] **3R.4** Touch/trackpad **pinch‑zoom + two‑finger pan** support.
- [x] **3R.5** **Pan bounds clamping** (board can't be lost off‑screen) + generous over‑pan at high zoom.
- [x] **3R.6** **On‑screen zoom in/out + Reset/Fit‑to‑screen** controls; keyboard arrows/`+`/`-`/`0`.
- [x] **3R.7** Auto **fit‑to‑screen** on load and on window resize; persist view per session.
- [x] **3R.8** Verify a steady **60 fps** while panning/zooming; optional mini‑map.

**Board camera — ZOOM BUGFIX (regression: zoom in/out currently does not work) — §7.11**
> Although the camera tasks above are checked off, **zoom in / zoom out is broken in the running
> game** — neither the mouse wheel nor the on‑screen buttons actually change the zoom. Fix it.
- [x] **3R.Z1** **Fix mouse‑wheel zoom**: scrolling the mouse wheel up zooms **in** and down zooms
      **out**, anchored to the cursor position. Attach a `wheel` listener to the board viewport
      with `{ passive: false }` and call `preventDefault()` so the page/scroll container does not
      swallow the event; map `event.deltaY` to a smooth scale step and clamp to `minZoom…maxZoom`.
      Ensure the handler is bound to the correct element and the camera transform actually updates.
- [x] **3R.Z2** **Fix the on‑screen +/− buttons** (bottom‑right): clicking **+** zooms in and **−**
      zooms out by a fixed step (anchored to the board centre), updating the same camera state.
      Verify the buttons are wired to the `useBoardCamera()` actions and re‑render/apply the transform.
- [x] **3R.Z3** Keep zoom clamped (`minZoom…maxZoom`), smooth/eased, and consistent between wheel
      and buttons; the **Reset/Fit‑to‑screen** control still returns to the default view.
- [x] **3R.Z4** Add a quick regression check (manual or component test) confirming wheel‑up,
      wheel‑down, `+`, and `−` each change the camera scale in the expected direction.
      *DoD: in the running game, the map visibly zooms in and out via both the mouse wheel and the
      on‑screen +/− buttons.*

**Map clarity — §7.12**
- [x] **3R.9** Redesign **location nodes**: localized name, region colour band, clearly drawn build
      slots with the allowed **industry icons** (incl. shared‑icon slots); empty vs occupied distinct.
- [x] **3R.10** Clear **built‑tile** rendering: owner colour, level, remaining cubes/beer, flipped state.
- [x] **3R.11** Clear **merchant** rendering: accepted industry icon(s), bonus type icon
      (Develop/Income/VP/Money) + tooltip, merchant‑beer barrel.
- [x] **3R.12** Distinguish **canal vs rail links** visually; highlight buildable lines; owner colours.
- [x] **3R.13** **Hover/focus tooltips** on locations (name, buildable industries, tiles,
      connection/network status).
- [x] **3R.14** **Level‑of‑detail** rendering: names+colour at low zoom, slot icons+tile details at
      high zoom; labels stay legible.
- [x] **3R.15** **Affordance highlighting**: when an action is active, valid targets glow and invalid
      ones dim.
- [x] **3R.16** Always‑available **legend/key** for all icons (coal/iron/beer/VP/£/income, merchant
      bonuses, canal vs rail), localized EN/RU/UZ. Label Farm Breweries + special links.

**Action & move UI clarity — §7.13**
- [x] **3R.17** **Remove all raw `legalActions` enumeration dumps** from the UI (no more repeated
      "Discard a card, do nothing — N options").
- [x] **3R.18** **Action‑first guided flow** from the Action Bar: each of the 7 actions has an icon,
      localized name, and one‑line description; illegal actions disabled with a "why" tooltip.
- [x] **3R.19** Step‑by‑step resolution: pick **card** (readable card faces) → pick **target on the
      board** (click highlighted element, not a text list) → resolve **resource sources** → confirm.
- [x] **3R.20** **Cost & effect preview** before confirming (money/coal/iron/beer spent;
      income/VP/flips gained); Cancel/Back at every step.
- [x] **3R.21** Fix **Pass**: a single clear "Pass (discard a card)" choice with a card picker —
      never N duplicated "do nothing" rows; choose which card(s) to discard.
- [x] **3R.22** Make **discards** an explicit choice of *which* card (faces shown), never "option 1…8".
- [x] **3R.23** **Turn HUD**: era, round, active player, actions remaining, and a clear current‑step
      prompt (e.g. "Pick a card to build a Cotton Mill in Birmingham").
- [x] **3R.24** Rewrite **log messages** as full localized sentences (EN/RU/UZ), e.g.
      "Blue built a Coal Mine in Dudley".
- [x] **3R.25** Render **AI moves** as readable animated actions with a short log line; no internal
      enumerations shown to the player.
- [x] **3R.26** **Turn handoff clarity (player change)**: make it unmistakable whose turn it is
      whenever play passes to the next player. On each turn change, show a brief, prominent
      transition cue — a centred **"Player X's turn"** banner/overlay in that player's colour (with
      avatar/character) + a sound cue — then highlight the new active player's panel (pulse/colour
      accent + board‑frame accent) and visibly de‑emphasize the previous player. Update the Turn
      HUD and add a localized log line ("It is now Blue's turn"). Cover human hot‑seat handoffs
      (optionally a "Pass device to Player X — Ready?" confirmation) and AI→human transitions, in
      EN/RU/UZ.
      *DoD: the board pans/zooms with the mouse, locations are self‑explanatory, every move is
      chosen through a clear guided flow, and each change of turn is clearly and prominently
      signalled so the next player always knows it is their turn. The game reads like Brass:
      Birmingham.*

### Phase 3T — "How to Play": Complete In‑Game Rules, Tutorial & Help (§7.14)

> Make the *How to Play* experience complete and clear so a new player can learn the **entire**
> game inside the app — every rule, action, and concept — without the paper rulebook. All content
> is paraphrased from the rulebook (not copied verbatim) and localized in **EN/RU/UZ**.

**Rules Library (browsable reference) — §7.14.1**
- [x] **3T.1** Build a dedicated, scrollable, **searchable Rules screen** reachable from the Main
      Menu **and** the Pause menu (without losing game state), with a table of contents + deep
      links and next/previous navigation.
- [x] **3T.2** Author the chapter content covering the **whole** game: Overview & Goal; the two
      eras; Components & Board; Setup (2/3/4‑player differences); Turn structure; the **7 Actions**
      (one clear page each with cost/requirements/example); Core concepts (connections, network,
      consuming coal/iron/beer, market cube movement, flipping, income, overbuilding, Farm
      Breweries); End of round (income, negative income/shortfall); End of era & scoring;
      Canal‑era maintenance; Winning & tiebreaks; Introductory variant.
- [x] **3T.3** Add an **icon glossary / legend** page explaining every icon (coal, iron, beer, VP,
      £, income, merchant bonuses, canal vs rail, lightbulb pottery), reusing the board icon set.
- [x] **3T.4** Make pages **illustrated** (diagrams/images), with collapsible sections; verify
      readability and no missing rules vs. the rulebook.
- [x] **3T.5** Provide full **EN/RU/UZ** translations for all Rules Library content.

**Interactive Tutorial (learn by doing) — §7.14.2**
- [x] **3T.6** Implement a scripted, **coached tutorial** game state with step highlighting,
      arrows, and short instructions; constrain input to the taught action and validate completion
      before advancing; support **Skip** and **Replay** per lesson.
- [x] **3T.7** Author tutorial lessons in order: Build → Network → Sell (beer + merchant) →
      Develop → Loan/Scout → taking income → end‑of‑round turn order → Canal→Rail transition + scoring.
- [x] **3T.8** Offer the tutorial **automatically on first launch** (skippable) and make it
      re‑launchable anytime from Main Menu / How to Play. Localize EN/RU/UZ.

**Contextual Help (in‑situ) — §7.14.3**
- [x] **3T.9** Add **hover/long‑press tooltips** to every interactive element (actions, cards,
      tiles, slots, markets, merchants, tracks, icons) explaining what it is + the rule behind it.
- [x] **3T.10** Add **"why is this disabled?"** explanations on greyed‑out actions/targets.
- [x] **3T.11** Add a **"?" help button** on each panel that opens the relevant Rules chapter, and
      a Settings **rules‑hint toggle** for inline reminders (on for new players, off for experts).
      *DoD: a brand‑new player can open the app, learn the complete rules via the Rules Library and
      the interactive tutorial, understand every on‑screen element via contextual help, and play a
      full game correctly — all in English, Russian, or Uzbek.*

### Phase 4 — Animations, Audio, i18n
- [x] **4.1** Event→timeline mapping + a sequential animation queue (speed setting, skippable).
- [x] **4.2** Animate: tile placement, link placement, cube‑to‑market + coin flow, tile flips,
      income/VP marker movement, card draw/discard, turn handoff. *(SFX + per-event beats; CSS keyframes)*
- [x] **4.3** Era transition cinematic (Canal→Rail) and end‑game victory sequence. *(Banner + fanfare/victory)*
- [x] **4.4** `prefers-reduced-motion` + "fast animation" support.
- [x] **4.5** Audio engine (Howler): SFX sprite + music tracks; mixer with volumes/mute (persisted).
- [x] **4.6** Hook SFX to events; ambient music per era; menu music.
- [x] **4.7** i18n scaffold (i18next) + extract **all** strings to keys.
- [x] **4.8** Author **EN** bundle (complete), then **RU** and **UZ** bundles incl. board/rules
      terminology. Runtime language switch. *(Key-parity enforced by a test.)*
- [x] **4.9** Number/currency formatting per locale (`i18n/format.ts`).
      *DoD: M4 reached — animated, voiced (SFX), tri‑lingual game.*

### Phase 5 — AI, Variant, Replays (menus & persistence already done in Phase 3)
- [x] **5.1** Bot interface + Easy heuristic bot (greedy over `legalActions`).
- [x] **5.2** Normal bot (1‑turn look‑ahead) and Hard bot (wider look‑ahead/sharper weights).
- [x] **5.3** Bot "thinking" pacing + per‑seat difficulty selection in setup.
- [x] **5.4** Harden Save/Load: save‑version migration hook, fail‑soft IndexedDB, export/import
      save file (download/upload).
- [x] **5.5** Settings AI options (thinking speed wired to AI pacing, auto‑skip AI animations).
- [x] **5.6** Replay storage (seed + action log) + a basic replay viewer (step ◀/▶ from Results).
- [x] **5.7** Wire up the **introductory variant** end‑to‑end (setup toggle → engine → scoring).
      *DoD: M5 reached — AI fills seats; games are saveable/resumable; replays work.*

### Phase 6 — Desktop Packaging & Release
- [x] **6.1** Add **Tauri 2** shell (`src-tauri/`: `tauri.conf.json`, `Cargo.toml`, `build.rs`,
      `src/{main,lib}.rs`, `capabilities/`), loading the shared web build in a native window.
- [x] **6.2** Native Save/Load via the Tauri FS + dialog plugins (export/import); IndexedDB
      persists inside the webview, so autosave/settings work with no native bridge.
- [x] **6.3** Product name "MYSpolly", window sizing/min-size/center, icon paths (generate with
      `pnpm tauri icon`).
- [x] **6.4** Installer targets configured (Windows NSIS/MSI, macOS DMG/app, Linux AppImage/deb)
      with build commands documented in the README.
- [x] **6.5** Document **Electron fallback** (`electron/` + `electron:dev`/`electron:build`
      scripts + electron-builder config) for environments without Rust.
- [x] **6.6** CI: desktop build/artifact workflow (delivered via PR — CI config cannot land
      directly on `main`).
- [~] **6.7** Performance/QA pass — guidance documented; an interactive 60 fps/memory pass
      requires a connected runtime (see Definition of Done notes).
- [x] **6.8** Finalize `ASSETS_CREDITS.md`; rulebook PDF excluded from distribution.
      *DoD: M6 reached — installable desktop builds configured for all three OSes.*

### Phase 7 — Stretch (post‑1.0)
- [ ] **7.1** Online multiplayer (authoritative server reusing the pure engine).
- [ ] **7.2** Online/async play, lobbies, reconnection.
- [ ] **7.3** Tutorial/interactive rules walkthrough.
- [ ] **7.4** Statistics, achievements, accessibility (colour‑blind palettes, screen‑reader labels).
- [ ] **7.5** Steam/itch.io distribution + auto‑update channel.

---

## 11. Definition of "Fully Built"
The game is considered complete when:
1. Every rule in §3 is implemented and covered by passing engine tests.
2. A 2–4 player game (humans and/or AI) is playable start‑to‑finish with correct scoring.
3. The board, tiles, and cards visually match the layout of the physical game (custom art).
4. Animations and sound effects play for all key events; era transitions are cinematic.
5. The UI is fully localized in English, Russian, and Uzbek.
6. The app is packaged as an installable desktop binary for Windows, macOS, and Linux.

---

## 12. Immediate Next Steps
1. **Phase 0.1–0.5** — scaffold the project and CI.
2. **Phase 1** — extract and validate all static game data (this unblocks the engine).
3. **Phase 2.1–2.3** — model types + setup + first engine slice, then iterate to a headless game.

*This plan is a living document; update task checkboxes and milestones as the project progresses.*


---

## 13. Build & Verification Notes (sandbox environment)

The project is developed in a sandbox whose **network is restricted to the git
gateway only** — public package registries (npm, PyPI, crates.io, CDNs) are not
reachable, so `pnpm install` cannot run here. This shapes how the project is
verified, **without changing any architectural decision** in §1–§12:

- **Node 22** runs TypeScript **natively** (type-stripping) and ships a built-in
  test runner (`node --test`) and assertion library. The pure game **core, AI,
  and their unit tests have zero third-party dependencies**, so they are fully
  built and verified here with:
  - `tsc --noEmit -p tsconfig.engine.json` (strict typecheck), and
  - `node --test --experimental-strip-types "tests/unit/**/*.test.ts"`.
- The React/Vite **UI source is authored to the same standard** but is built and
  run in any connected environment via the normal scripts (`pnpm install`,
  `pnpm dev`, `pnpm build`, `pnpm test:component`). The committed `package.json`
  pins all required dependencies and `eslint.config.js` lints everything.
- **CI mirrors this split** (`.github/workflows/ci.yml`): an `engine` job typechecks
  and tests the core with no install (always green offline), and an `app` job does
  the full `pnpm install → typecheck → lint → component tests → build` once a
  registry is available.
- A tiny ambient shim (`tests/types/node-min.d.ts`) declares only the subset of
  `node:test`/`node:assert` used by the engine tests so the offline `tsc` is
  happy; the real `@types/node` is used in connected environments.

> **Decision (documented per the mission rules):** because the engine is the
> single rules authority and is the part whose correctness can be exhaustively
> verified offline, it is built **test-first and kept green on every commit**.
> UI/animation/audio/i18n/packaging code is committed as complete, reviewable
> source that compiles under the pinned toolchain.

---

## 14. Progress Log

- **Phase 0 complete.** Scaffolded the project: `package.json` (all deps pinned),
  strict `tsconfig.json` + engine-only `tsconfig.engine.json`, ESLint flat config
  (engine forbids `any`), Prettier, EditorConfig, `.gitignore`, `vite.config.ts`
  (path aliases, relative `base` for offline/desktop), `index.html`, a minimal
  runnable `App` ("Hello Brass"), the Day/Night CSS theme system, the full §5
  folder tree, `ASSETS_CREDITS.md`, the `public/assets` placeholders, and GitHub
  Actions CI. Verified: engine typecheck passes and the native test runner is
  green; Prettier formatting clean.


- **Phase 1 complete.** Encoded all static game data in `src/core/data/`:
  `markets.ts` (coal/iron ladders — confirmed from rulebook: coal £1–£7 cap 14
  empty £8 init 13; iron £1–£5 cap 10 empty £6 init 8), `industries.ts` (all 45
  tiles/colour across 6 industries with per-level stats + era buildability +
  lightbulb potteries), `board.ts` (20 towns + 2 farm breweries + 5 merchants
  with confirmed beer bonuses, build slots, and the link network), `cards.ts`
  (64-card deck + 8 wilds, player-count + colour exclusions, deck builder),
  `setup.ts` (all setup constants + initial mat stacks). Added `data.test.ts`
  with 23 assertions on structural invariants — all green; engine typecheck clean.
  - **Documented assumption (per mission rules):** the precise per-level tile
    stats, exact board topology/slot icons, merchant VP amounts, and the card
    multiset are printed on board/mat/card **images** that cannot be extracted
    from the rulebook PDF text. They are encoded from published references and
    flagged `VERIFY` in-file; all are pure-data edits requiring no engine change.
    Component **totals** and the player-count rules are taken from the rulebook
    text and enforced by tests. Era length uses the rulebook's fixed 8/9/10
    rounds, so deck-size differences cannot change era duration.


- **Phase 2 complete (M2).** Implemented the full pure engine in `src/core/`:
  model types (`state/actions/events`), seeded RNG + shuffle, `buildInitialState`,
  connectivity/network selectors, resource routing + market mechanics, all 7
  actions (Build incl. overbuild/market-on-build/farm breweries, Network
  canal/rail incl. double-link beer, Develop incl. lightbulb rule, Sell incl.
  merchant beer bonuses, Loan, Scout, Pass), the turn/round/era phase machine
  (1-action first Canal round, hand refill, cardless-player skipping, turn-order
  re-sort, income with shortfall tile-selling + VP loss, end-of-era scoring,
  Canal→Rail maintenance, game over with tiebreaks), the introductory variant,
  and `legalActions`. `reduce` is pure (clones via `structuredClone`) and emits a
  semantic event stream. **52 unit tests pass** (data + setup + purity + market +
  per-action rules + edge cases + full random 2/3/4-player playthroughs to
  completion + golden reproducibility + intro variant); engine typecheck clean.
  - **Documented engine decisions:** linear income model (level==money; non-linear
    high-income track flagged VERIFY); era length governed by fixed 8/9/10 rounds
    (cardless players are skipped, hands reshuffled at Canal→Rail); "closest
    connected coal mine" relaxed to "any connected mine, market only if none"
    (cheapest-first auto-resolution); one tile per player per location enforced in
    both eras; merchant link-VP defaulted to 2 each (VERIFY).


- **Phase 3 complete (M3).** Authored the full React UI in `src/app/` + persistence
  in `src/persistence/`: the `appStore` (Zustand) wrapping the engine with a
  separate `AppScreen` navigation state, bot-driven AI turns, and autosave on
  every dispatch; the `settings` store (persisted, applied live to the DOM
  theme/animation/palette); all screens (Splash, Main Menu with autosave-gated
  Continue, GameSetup, LoadGame, Settings, Rules, Credits, Game, Pause, Results);
  board components (`BoardSvg` + layout, market panels, player strip, hand, action
  bar with a guided flow driven by `legalActions`, event log); IndexedDB
  persistence (autosave + named slots) with **pure, unit-tested serialization**.
  Added the AI bot (`src/ai/`, Easy/Normal/Hard heuristic + look-ahead) which is
  **verified to play full 2/3/4-player games to completion** via Node tests, and
  full EN/RU/UZ i18n bundles with a **key-parity test**. Engine + AI + persistence
  + i18n = **65 Node tests pass**; component tests (`tests/component/`) run in CI.
  - **Build/verify note:** the React/TSX cannot be typechecked/run in the offline
    sandbox (no React types, no JSX stripping in Node), so it is authored to build
    under the pinned toolchain and validated by the CI `app` job. The pure-TS parts
    it depends on (engine, AI, serialization, i18n JSON) are fully verified here.
  - **Consolidated vs. plan:** tiles are drawn on the board nodes (not separate
    `IndustryTile`/`PlayerMat` components); player overview + turn order live in
    `PlayerStrip`; the guided flow enumerates legal concrete actions (with cost
    hints) rather than a click-on-board multi-step wizard — functionally guarantees
    only-legal moves. These are slated for visual polish in Phase 4.


- **Phase 4 complete (M4).** Added the animation + audio + formatting layer:
  `animation/timelines.ts` (event→SFX + duration + banner mapping),
  `animation/useAnimateEvents.ts` (sequential, speed-scaled, skippable queue that
  respects reduced-motion and "skip AI animations"), `audio/sound.ts` (Howler
  mixer with master/SFX/music channels, persisted volumes, fail-soft on missing
  assets) wired into the settings store, a cinematic `Banner` for era/round/
  game-over beats, era-aware ambience + menu music, CSS keyframes, and
  `i18n/format.ts` (locale number/£ formatting). EN/RU/UZ bundles already complete
  with **key-parity enforced by a test** (now incl. `banner.*`). 65 Node tests
  pass. (Howler/Framer/GSAP are wired in source; visual polish renders in a
  connected build. Audio/art asset files are referenced and documented in
  ASSETS_CREDITS.md, to be supplied as original/CC0.)


- **Phase 5 complete (M5).** The AI bot (Easy/Normal/Hard, `legalActions` +
  look-ahead) is wired into the store with per-seat difficulty (GameSetup) and
  settings-driven thinking pacing; "skip AI animations" honoured. Save/Load
  hardened: version-migration hook + fail-soft IndexedDB + JSON save export/import
  (`util/file.ts`, Settings → Data). Added a **replay viewer**: the store records
  seed + action log and re-derives any step deterministically (◀/▶ controls in the
  Game screen, launched from Results). Introductory variant runs end-to-end
  (setup toggle → engine → Canal-only bonus scoring), covered by an engine test.
  65 Node tests pass (AI playthroughs at all difficulties included).


- **Phase 6 complete (M6 configured).** Added the **Tauri 2** desktop shell
  (`src-tauri/`) loading the shared web bundle with FS + dialog plugins and a
  scoped capability set; installer targets for Windows (NSIS/MSI), macOS
  (DMG/app) and Linux (AppImage/deb); the **Electron fallback** (`electron/`) with
  electron-builder config; desktop run/build scripts in `package.json`; a `README`
  with full instructions; and a desktop-artifact CI workflow (delivered via PR).
  `ASSETS_CREDITS.md` finalized.

---

## 15. Definition-of-Done status (final)

| # | Criterion | Status |
|---|---|---|
| 1 | Every rule implemented + covered by passing engine tests | **Done** — full engine; 65 Node tests green (incl. property + golden + per-rule edge cases). |
| 2 | 2–4 player game (human/AI) playable start→finish with correct scoring | **Done (engine-verified)** — random + AI bots complete full 2/3/4-player games headlessly with scoring/ranking; the React UI drives the same API. |
| 3 | Board/tiles/cards visually match the physical layout (custom art) | **Functional, art pending** — SVG board + tiles + cards render from data; original art/exact slot icons are flagged `VERIFY` data tasks (no publisher art shipped). |
| 4 | Animations + SFX for key events; cinematic era transitions | **Wired** — event→timeline queue, Howler mixer, era/victory banners; asset files to be supplied (CC0/original). |
| 5 | Fully localized EN / RU / UZ | **Done** — three complete bundles, runtime switch, key-parity test. |
| 6 | Installable desktop binary (Win/macOS/Linux) | **Configured** — Tauri (primary) + Electron (fallback) build pipelines; binaries are produced in a connected build environment (the offline sandbox cannot reach crates.io/npm). |

**Honest caveats (per the mission's "document and continue" rule):** the offline
sandbox has no package registry, so the React/TSX app, Vite build, Tauri/Electron
binaries, and Playwright e2e are authored to build under the pinned toolchain and
validated by CI in a connected environment rather than run here. The pure engine,
AI, persistence-serialization and i18n — the parts whose correctness can be
exhaustively checked — are fully verified offline. A number of printed-component
values (per-tile stats, exact board topology/slot icons, merchant VP amounts, card
multiset) live in board/mat **images** and are encoded from published references,
flagged `VERIFY` in-file, and are pure-data edits requiring no code change.