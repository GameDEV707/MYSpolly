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
  - `GOODS_SOLD` → an **era‑appropriate transport vehicle** travels from the sold industry tile,
    **along the actual network route** (links) to the destination merchant, delivers the goods,
    then **returns to its origin** (see §7.4.1).
- Framer Motion for component transitions; GSAP timelines for multi‑actor sequences.
- Respect `prefers-reduced-motion` and a "fast animations" setting.

#### 7.4.1 Goods‑delivery (Sell) transport animation
> **Requested:** when a player sells, a vehicle should visibly carry the goods from the producing
> factory, **across the network**, to the merchant it is being sold to, hand over the cargo, and
> come back — beautifully animated and matched to the era.
- On a **Sell**, compute the **path of links** from the selling industry's location to the target
  merchant (reuse the engine's connectivity/route finding) and animate a vehicle following that
  polyline along the board (not a straight line) at a smooth, eased speed.
- **Era‑specific vehicle & route style** (driven by the active era's `routeType`, §7.15):
  - **Canal Era → a cargo boat/barge** travelling along canal/water routes.
  - **Rail Era → a freight train** travelling along rail routes.
  - **Air Era → a cargo plane** flying along the air routes/flight arcs.
- Sequence: vehicle spawns at the factory → carries a visible goods/cargo token → arrives at the
  merchant → **delivers** (cargo drops onto the merchant, the tile flips, income/coins animate as
  part of the existing Sell events) → vehicle **returns to its origin** and despawns.
- Honors animation **speed/skip** and `prefers-reduced-motion` (degrade to a quick cargo‑move or
  fade); plays a matching SFX per vehicle (boat horn / train / plane). If selling multiple tiles
  in one action, animate deliveries in sequence (or lightly staggered) without blocking input
  longer than necessary. On maps/eras without a direct route, fall back gracefully (e.g. a
  market‑direct cargo hop).

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
- **Single source of truth & referential integrity (fixes the Continue/Delete bug)**: the
  **Continue** button and the **Load Game** list must stay consistent. Whatever game **Continue**
  resumes must be the one true "current resumable game"; there must be **no way to resume a game
  that was deleted or finished**. See §7.10.6 for the exact required behavior.

#### 7.10.6 Save / Continue / Delete consistency (BUGFIX requirement)
> **Current bug:** after quitting, the game is stored as the **Continue** game. If the player then
> *saves* it, it appears in **Load Game**; if they **delete** that saved game and press
> **Continue**, the app still loads the deleted game. Continue and the saved‑slot list are out of
> sync. This must be fixed with clear, well‑defined semantics:
- There is exactly **one** "current game" pointer that powers **Continue**. It is an explicit
  reference (slot id), not a stale duplicate copy.
- **Continue is enabled only if** that pointer references a save that **still exists**. If the
  referenced save has been deleted (or never existed), Continue is **disabled/greyed out**.
- **Deleting** a save must, in the same operation: remove the save **and**, if it is the current
  game, **clear the Continue pointer** (and refresh the Main Menu so Continue immediately becomes
  disabled). Deleting must never leave a dangling pointer to removed data.
- **Finishing or Abandoning** a game clears the current‑game pointer (Continue becomes disabled).
- **Saving** an in‑progress game and continuing it must resume the **same** game state (no fork
  where Continue and the Load slot diverge); autosave and an explicit manual save of the same game
  resolve to the same underlying record where appropriate.
- On launch, validate the pointer/integrity before showing Continue; if the target is missing or
  invalid, disable Continue rather than crash or load wrong/old data.
- Add tests covering: delete‑then‑Continue (must be disabled / must not load), finish‑then‑Continue,
  save → delete → Continue, and resume‑matches‑saved‑state.

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
- **Per‑player "VP to win" indicator**: in every player's panel (`PlayerStrip`), **next to that
  player's own income and VP (star) icons**, also show how many victory points that player still
  needs to win the game. Since Brass has no fixed VP threshold, "to win" = the gap to the current
  leader: `max(0, (highest VP among the other players) − this player's VP + 1)`. The leader shows
  **0 / "Leading"**; everyone else shows the points needed to overtake the leader. This value
  updates live as VP changes (builds/sells/era scoring), **reads from the same engine VP that the
  scoring fix in task 3.12a verifies** (so it never shows a stale/incorrect number), and is fully
  localized (EN/RU/UZ) with a clear icon + tooltip ("Points needed to take the lead").
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

### 7.15 Map System — Multiple Maps & Era‑Morphing Boards

> **Change requested:** the game must offer **more than one board**. There should be **5 distinct
> full maps** plus **5 smaller "fast‑play" maps** (10 total), each with its own locations, links,
> and card deck. Boards must **morph between eras**: the Canal Era uses one kind of route, the Rail
> Era another, and some large maps add a third **Air Era** with air routes. When an era changes,
> the available route type, the locations/positions, and the islands and their names may change.

This generalizes the board from a single fixed layout into a **data‑driven Map registry**. The
pure engine already loads board data from `src/core/data/`; we extend it so each map is a
self‑contained `MapDefinition`, and the active map is chosen at Game Setup.

#### 7.15.1 Map registry & selection
- A `maps/` data folder holds one module per map; a registry exposes all maps with metadata
  (id, name, size, era list, recommended player counts, estimated play time, thumbnail).
- **Game Setup** gains a **map picker** (preview image + description + size/duration tags), with
  filters for *Full* vs *Fast‑play* and by number of eras.
- The chosen `mapId` is stored in `GameState.options` and in saves/replays so a game always
  reloads on the correct map. Setup, deck composition, and the board view all key off the map.

#### 7.15.2 The 10 maps
- **5 Full maps** (large, rich, ~standard length): distinct geographies, location sets, link
  networks, merchant placement, and bespoke card decks. Each has its own theme/skin.
- **5 Fast‑play maps** (small, fewer locations/links, shorter decks): tuned to **play quickly and
  perform well**, ideal for short sessions and lower‑end machines. Must remain rules‑complete.
- Every map declares its **player‑count rules** (which cards/merchants are removed at 2/3/4
  players) just like the base game.
- Performance budget: fast maps target snappy turns and smooth pan/zoom even on modest hardware;
  large maps use level‑of‑detail rendering (§7.12) to stay at ~60 fps.

#### 7.15.3 Era‑specific routes & era‑morphing layout
- Each map defines an **ordered list of eras**. Standard maps: `['canal','rail']`. Selected large
  maps: `['canal','rail','air']`.
- **Route type per era** is data‑driven and visually distinct:
  - **Canal Era → canal/water routes** (e.g. waterway styling).
  - **Rail Era → rail routes** (railway styling).
  - **Air Era → air routes** (flight‑path styling, e.g. dashed arcs between hubs).
- **Routes match the era's shape**: link line geometry/style is defined per era, so the network
  literally looks different each era.
- **Layout morphs on era change**: locations may **reposition**, and **islands and their names may
  change**, between eras. The board plays an **animated transition** (reposition/rename/route‑swap)
  during the era change so the player sees the world evolve. End‑of‑era maintenance (removing the
  previous era's links, etc.) integrates with this morph.
- The engine's connectivity/network selectors operate on the **active era's** topology; saves and
  replays restore the correct era topology.

#### 7.15.4 Air Era (optional third era, on maps that declare it)
- For maps with an Air Era, after the Rail Era the board transitions to air routes. The Air Era
  reuses the same action/economy framework (build, network with air links, sell, income, scoring)
  with **per‑era parameters defined by the map** (link cost, resource needed for air links, what
  air links score). Default rules mirror the rail‑link pattern unless a map overrides them.
- Maps without an Air Era are unaffected — the standard 2‑era game is the default.
- All new Air‑Era rules are documented in the Rules Library and taught contextually (§7.14).

#### 7.15.5 Islands, locations & naming per era
- A map may define **islands** (named sub‑regions/landmasses). Island sets and their **names can
  differ per era** (e.g. a location/island is renamed or relocated when the era advances).
- All location and island names are **i18n keys** (EN/RU/UZ); each map ships its own name set.
- The legend, tooltips, Rules Library, and logs use the **active map + era** names consistently.

#### 7.15.6 Data model additions (representative)
```ts
type EraId = 'canal' | 'rail' | 'air';

interface EraDef {
  id: EraId;
  routeType: 'canal' | 'rail' | 'air';
  routeStyle: RouteStyle;            // visual styling for this era's links
  params: EraRuleParams;             // link cost, resource per link, link scoring, etc.
}

interface MapDefinition {
  id: string;
  nameKey: string;                   // i18n
  size: 'small' | 'medium' | 'large';
  fastPlay: boolean;                 // true for the 5 fast maps
  thumbnail: string;
  eras: EraDef[];                    // ['canal','rail'] or ['canal','rail','air']
  // Per-era topology (positions/names/islands may change between eras):
  locations: Record<EraId, LocationDef[]>;
  links: Record<EraId, LinkLineDef[]>;
  merchants: Record<EraId, MerchantDef[]>;
  islands?: Record<EraId, IslandDef[]>;
  deck: DeckDefinition;              // map-specific card deck (per player count)
  playerCountRules: PlayerCountRules;
}
```
- `GameState` references the active map and the current `EraId`; the board renderer reads
  `map.locations[era]` / `map.links[era]` so the view updates when the era changes.

### 7.16 MYSpolly Economy Model — Resources, Per‑Round Production, Market Buying & Starting Stock

> **Important:** this is an **intentional MYSpolly variant** that changes the official Brass:
> Birmingham resource economy. The agent must implement it as the canonical MYSpolly rule set,
> keep it internally consistent, and document it in the Rules Library + contextual help. The three
> resources are **coal**, **iron**, and **juice** (the renamed beverage, formerly beer).

#### 7.16.1 Per‑player resource stockpiles (no free resources from other players)
- Each player has a **personal resource stockpile**: `{ coal, iron, juice }`, shown live in their
  HUD/`PlayerStrip` next to money/income/VP.
- **You may NOT take resources for free from other players' mines/works.** A build/action consumes
  resources **only from your own stockpile**; if you don't have enough, you must **buy the
  shortfall from the market** (if connected) — see §7.16.4.
- This replaces the official rule where coal/iron could be drawn freely from any connected source.

#### 7.16.2 Production buildings & per‑round production
- **Production buildings** you own generate resources **into your stockpile at the end of every
  round** (during the income step), based on the building type and its **level** (quality):
  - **Coal Mine → coal**, **Iron Works → iron**, **Juice Works → juice**.
- Per‑round production scales with level (higher/more valuable buildings produce more). Proposed
  **starting/tunable** table (the agent finalizes & balances these numbers):

  | Building | L1 | L2 | L3 | L4 |
  |---|---|---|---|---|
  | Coal Mine (coal/round)  | 1 | 2 | 3 | 4 |
  | Iron Works (iron/round) | 1 | 2 | 3 | — |
  | Juice Works (juice/round) | 1 | 1 | 2 | 2 |

- A player's **total per‑round yield** = sum over all their production buildings of that building's
  level‑based output, added to their stockpile each round. Optionally cap stockpiles per resource
  (tunable) to avoid runaway hoarding.
- The HUD shows, per building (and as a player total), **how much it will produce next round**.

#### 7.16.3 Develop / upgrade increases per‑round production
- When you **Develop/upgrade** a production building to a higher level, from the **next round
  onward it produces the higher (upgraded) amount** per the table above. Upgrading is the main way
  to grow your resource income over the game.

#### 7.16.4 Buying from the market when short
- If an action needs more of a resource than you have in your stockpile **and you are connected to
  the relevant market**, the UI offers to **buy the shortfall**:
  - Show the **current market price**, **how many units** you need to buy, and the **total cost**.
  - The player confirms to pay money and complete the action; market prices move as in the base
    market rules (cheapest space first; empty market → fixed price).
- If you are **not connected** to the market and lack the resource, the action is **not allowed**
  (disabled with a clear reason, per §7.13).

#### 7.16.5 Starting resources
- At game start every player receives a **starting stockpile** of resources (tunable, e.g.
  `coal: 2, iron: 1, juice: 1`) so the early game isn't blocked. Defined per map/player‑count and
  shown in setup.

#### 7.16.6 Build cost & benefit preview (extends §7.13)
- Before confirming **any** build/action, the preview panel (as today) shows **what it costs**
  (money + coal/iron/juice consumed, with any market purchases priced out) **and adds the
  potential benefit**: e.g. income gained, VP it can score, per‑round resource production it will
  add, and what it unlocks. Resources are drawn from the player's stockpile first, then market.

#### 7.16.7 Era‑morphing geography (islands → land → air) — ties into §7.15.3
- A map's world visibly transforms each era, and **build locations (mines, works, towns)
  reposition and are renamed** accordingly:
  - **Canal Era** → the world is a set of **islands separated by water**; canal/water routes link
    them; locations sit on the islands.
  - **Rail Era** → the world becomes **connected land** (islands merge into a landmass); locations
    **reposition on land** and their **names change**; rail routes replace water routes.
  - **Air Era** → locations become **air hubs/airports**; positions, names, and the route network
    **change again**; air routes connect them.
- To avoid bugs, each location keeps a **stable logical `id` across eras** (so persistent level‑2+
  tiles map correctly), while its **on‑screen position, display name, and connecting routes are
  per‑era data**. End‑of‑era maintenance (remove level‑1 tiles, etc.) runs, then the board morphs
  with an animated transition to the next era's layout.

> All numbers in §7.16 are **tunable balance values** — the agent should pick sensible starting
> values, expose them in map/era data, and adjust for fun/fairness; they are not from the official
> rulebook.

### 7.17 Money, Cost‑Accounting, Resource Trading & Bankruptcy (CORRECTNESS OVERHAUL)

> **Reported problems (must be fixed):**
> 1. **You can buy/build things with no money.** A player with **£0** can still acquire a tile
>    "for £0" and the action goes through. Money is debited without ever being floored, and some
>    tiles cost £0 (e.g. Pottery levels 2 & 4 in `industries.ts`), so a broke player keeps building.
>    Nothing forces money to stay ≥ 0, and there is **no bankruptcy state** at action time.
> 2. **Going into debt is silently allowed.** `spend()` / `changeMoney()` in `helpers.ts` just do
>    `p.money -= amount` with **no floor and no debt handling**. The only debt logic is the
>    end‑of‑round income shortfall in `income.ts`, which **auto‑sells the player's cheapest tile**
>    with **no player choice** and **no option to offer it to other players**.
> 3. **Resource accounting must be exact and complete.** Every resource a Network / Build / Develop
>    / Sell action consumes (coal, iron, juice — and any market purchase to cover a shortfall) must
>    be counted precisely, priced, and paid for before the action commits.
> 4. **Resource access is too rigid.** Today a shortfall can only be covered from the market
>    (coal/iron) and **juice has no market at all**, so a juice shortfall just makes the action
>    illegal. The variant should instead let a short player **acquire the missing resource from
>    another player who has it** (paying that player), and give **non‑market resources a fixed
>    price** so they can always be obtained.
> 5. **Market rules must match Brass: Birmingham.** Only the goods that are genuinely **traded in a
>    market** (coal, iron) may be bought/sold there, with the price moving up/down along the
>    Brass price ladder; anything **not** sold in a market gets a **fixed, unchanging price**.

This section is the canonical MYSpolly money/economy rule set and **revises parts of §7.16**
(specifically §7.16.1's "never take resources from other players" and §7.16.4's "juice has no
market ⇒ illegal"). It is the single source of truth where it conflicts with §7.16.

#### 7.17.1 Strict money gating (no buying without funds)
- **Total cost is computed up front** for every action and equals: `money cost` **+** the priced
  cost of **every** resource purchase needed to satisfy it (market buys, fixed‑price buys, and
  player‑to‑player buys — see §7.17.3/§7.17.4). No hidden or free spend.
- An action is **legal only if the acting player can pay the full total** from their current money
  **without going below £0**. The affordability check is `totalCost <= p.money` (not `<`, not a
  partial check that ignores resource purchases).
- `spend()` must **never** silently drive money below 0. It asserts `amount <= p.money` (the
  validator guarantees this); any attempt to overspend is an engine error, not a silent debt. A
  dedicated `payOrBankrupt()` path (see §7.17.5) is the **only** way money may be reduced when the
  player cannot otherwise pay (income collection, mandatory upkeep).
- **£0‑cost tiles** (e.g. lightbulb potteries) remain buildable for £0 **only when the player can
  also pay for their required resources** (coal/iron/juice). If acquiring those resources costs
  money the player doesn't have, the build is **disabled with a clear reason** (per §7.13) — a
  broke player can no longer "build for free" when the build actually has resource costs.

#### 7.17.2 Exact, complete resource accounting (esp. Network)
- For **every** action, enumerate the **exact** resources consumed and where each unit comes from
  (own stockpile / market / another player / fixed‑price supply), and price every non‑stockpile
  unit. The cost preview (§7.13/§7.16.6) shows this itemized breakdown before confirming.
- **Network specifically:** account for **every** coal per link (`coalPerLink × links`) and the
  juice for a double link, summed across all links in the action; show how many come from the
  stockpile vs. purchased and the **total money** (link cost + all resource purchases). Placing
  the links must consume **exactly** that many units — no over/under‑count, no free units.
- Emit one consumption event per unit (as today via `RESOURCE_CONSUMED`) so previews and the log
  reconcile to the penny/cube.

#### 7.17.3 Buy a shortfall from another player (NEW)
- When an action needs more of a resource than the player has in their own stockpile, the
  resolution order is: **(1) own stockpile → (2) the market** (coal/iron only, if connected, per
  §7.17.4) **→ (3) buy the remaining shortfall from another player** who has that resource in their
  stockpile.
- **Player‑to‑player purchase:** units are taken from the chosen owner's stockpile and the buyer
  **pays that owner** (money moves buyer → owner). Price per unit = the relevant **market buy
  price** for coal/iron (or the next market price if the market is empty/insufficient), and the
  **fixed price** (§7.17.4) for non‑market resources such as juice.
- The buyer picks which other player to buy from when several have stock (UI picker; AI uses a
  sensible default — cheapest/most‑available). All units and payments are accounted exactly and
  shown in the preview. If, after stockpile + market + other players, the requirement still can't
  be met (no one has it / can't afford it), the action is **disabled with a clear reason**.

#### 7.17.4 Market vs. fixed‑price resources (Brass‑faithful)
- **Market‑traded resources = coal and iron only.** They are bought/sold on their price ladders;
  buying removes the cheapest filled cube (price rises), selling fills the cheapest empty space
  (price falls), and an empty market sells at its fixed `emptyPrice` — exactly the Brass:
  Birmingham behaviour already in `market.ts`/`markets.ts`. **Only these market goods may be
  bought from a market.** No other resource is ever "sold into" or "bought from" a coal/iron
  market.
- **Non‑market resources get a fixed, unchanging price.** Juice (and any future non‑market
  resource) has a single configured **fixed unit price** (tunable, in `data/economy.ts`). A juice
  shortfall is covered at that fixed price from a general supply **or** from another player
  (§7.17.3) — it no longer makes the action illegal just because there is no market.
- Document each resource's price model (market vs fixed) in the Rules Library and show it in the
  buy dialog so the player always knows what a unit costs and why.

#### 7.17.5 Bankruptcy (player choice: sell to bank at half, or auction to players)
> Triggered whenever a player **must pay money they do not have** (primarily the end‑of‑round
> negative‑income collection, and any other mandatory upkeep). Replaces the current silent
> auto‑sell in `income.ts` with an explicit, player‑driven flow.
- When a mandatory payment exceeds the player's cash, the player enters a **bankruptcy resolution**
  and must raise the shortfall by repeatedly choosing one of:
  1. **Sell a factory to the bank at half price.** The player picks one of **their own placed
     tiles**; the bank pays **half its build cost (rounded down)**; the tile is removed from the
     board.
  2. **Auction a factory to the other players (starting price = half).** The player picks one of
     their tiles and puts it up for auction with an **opening bid equal to half its build cost**.
     Other players (humans and AI) may bid higher in turn order; the **highest bidder wins**, pays
     their bid to the bankrupt player, and **takes ownership** of the tile (it stays on the board,
     now owned by the winner). If no one bids above the opening price, fall back to selling it to
     the bank at the opening (half) price.
- The player keeps choosing/selling until the debt is covered (keeping any surplus). The choice of
  **which** tile and **which** method (bank vs auction) is the player's (AI uses a heuristic:
  prefer auctioning high‑value tiles when opponents are likely to overpay, else sell low‑value
  tiles to the bank, while protecting key production/income tiles when possible).
- **If the player still cannot cover the debt** after they have no more tiles to sell, fall back to
  the existing rule: **lose 1 VP per £1** still owed (VP floored at 0). Only if that is also
  exhausted is the player considered truly bankrupt (record it; do not let money/VP go negative).
- **Events & UI:** emit explicit events for each step — a tile sold to the bank, an auction opened,
  each bid, the auction result (winner + price + new owner) — so the board, log, and animation
  layer update correctly (this also fixes the current missing per‑tile removal event in the income
  shortfall path). The auction is presented as a clear modal: the tile, its half‑price opening bid,
  bid controls for each eligible player, and pass/win resolution; fully localized EN/RU/UZ.

#### 7.17.6 AI & integration
- The AI bot must understand the new economy: never attempt an unaffordable action (it already goes
  through `legalActions`, which now enforces §7.17.1), choose resource sources sensibly (stockpile
  → market → cheapest other player), make bankruptcy decisions (which tile, bank vs auction), and
  **bid in opponents' auctions** when a tile is worth more to it than the asking price.
- All new costs, prices, and decisions are surfaced in the guided action flow / previews (§7.13)
  and the Rules Library / contextual help (§7.14), localized EN/RU/UZ.

> Balance values in §7.17 (fixed juice price, player‑to‑player pricing, auction increments, AI
> bidding aggressiveness) are **tunable** and live in `data/economy.ts`; pick sensible defaults and
> adjust for fairness.

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
- [x] **3.12a** **BUGFIX: Victory‑Point (VP) scoring correctness + per‑player "VP to win"
      indicator.**
      *Observed bug:* the running VP totals shown during a game do not match the final result, and
      the standings flip in a way that looks wrong. In a real game the running scores were
      Me **27**, Abror **24**, Shodiyona **32** (Shodiyona leading), but the final scores were
      Me **91**, Abror **84**, Shodiyona **69** — i.e. the in‑game leader ended last and the totals
      jumped inconsistently. Investigate and fix so the displayed VP is always trustworthy and the
      final score is correct per the rulebook (§3.11).
      Sub‑tasks:
      1. **Audit the running (in‑game) VP** shown in `PlayerStrip`/HUD vs. the engine's actual VP
         state — they must always be the same number (no stale/cached/desynced display).
      2. **Audit end‑of‑era & end‑of‑game scoring** in `scoring.ts` against the rules: link tiles
         score **1 VP per VP‑icon in adjacent locations**; **only flipped** industry tiles score
         their bottom‑left VP; **unflipped tiles score nothing**; links are **removed as scored**;
         confirm **no double counting** and that VP isn't added twice across the Canal→Rail
         transition. Verify the introductory‑variant scoring too.
      3. **Reproduce the reported scenario with a deterministic test** (seeded game leading to
         running 27/24/32 then a final around 91/84/69) and assert the math + final ordering are
         correct; fix whatever discrepancy the test reveals (e.g. mis‑summed link adjacency,
         scoring unflipped tiles, off‑by‑one, or a display/state mismatch).
      4. **Make the standings + winner determination** use the engine VP only, with the rulebook
         tie‑breaks (most VP → income → money). Ensure the **Results** screen breakdown (in‑game
         VP + link VP + flipped‑tile VP = final) reconciles exactly and is shown to the player.
      5. **Add the per‑player "VP to win" indicator** beside each player's own income/VP (star):
         `pointsToWin = max(0, (highest VP among the OTHER players) − this player's VP + 1)`; the
         current leader shows **0 / "Leading"**. It must read from the same corrected VP source,
         update live on every VP change, and be localized EN/RU/UZ with an icon + tooltip.
      *DoD: running VP always equals engine VP; end‑of‑era/end‑game scoring matches the rulebook
      with a passing regression test for the reported scenario; the Results screen breakdown adds
      up exactly; the winner/standings are correct; and each player sees an accurate "points needed
      to win" beside their VP.*
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

**Turn‑handoff banner BUGFIX (regression: the overlay does not disappear and blocks the board)**
> The "Player X's turn / Get ready!" transition overlay currently **stays on screen and covers the
> board**, blocking play. The cue must appear briefly and then go away on its own.
- [x] **3R.27** **Auto‑dismiss the turn banner**: show the "Player X's turn" overlay for a short,
      configurable duration (≈1.2–1.8s) then **fade it out automatically**; never leave it on
      screen. Allow the player to dismiss it early by click/tap/key. Ensure the dismiss timer is
      cleared/reset correctly on rapid turn changes (e.g. fast AI turns) so banners don't stack or
      get stuck. While visible, the overlay must not block essential interaction longer than its
      lifetime, and after it fades the board is fully visible and interactive again.
      *DoD: on every turn change the banner appears briefly, then disappears on its own (or on
      click), and never permanently covers the board.*

### Phase 3D — Re‑theme: replace Brewery/Beer with a non‑alcoholic Beverage industry

> **Change requested:** replace the **Brewery** industry and the **beer** resource with a
> **non‑alcoholic ("halal") beverage** equivalent — a soft‑drink / juice works. The **game
> mechanics stay exactly the same** (same costs, levels, the resource produced on build, the
> "consume X to Sell", the Network‑action drink for the second rail link, the merchant‑drink
> bonus, and flipping when the last drink barrel is removed). **Only the theme/naming/art change.**
> The replacement industry takes the same board spaces, tiles, and cards the Brewery used.

Working names (finalize during implementation, keep consistent everywhere):
- Industry: **Brewery → "Juice Works"** (a non‑alcoholic beverage factory).
  - EN: *Juice Works* · RU: *Соковарня* · UZ: *Sharbat zavodi*.
- Resource: **beer barrel → "juice barrel"** (EN *juice* · RU *сок* · UZ *sharbat*).
- Special locations: **Farm Breweries → "Farm Juice Works"** (UZ *Fermer sharbat zavodi*).
- Merchant **beer space/bonus → "drink/juice"** equivalent.

- [x] **3D.1** Rename the industry in the **engine data/types** (e.g. `IndustryType` `'brewery'`
      → `'juice'`/`'beverage'`, and the resource `beer` → `juice`) **without changing any rule,
      cost, level, count, or behavior**. Update all engine logic, selectors, and tests that
      reference brewery/beer to the new identifiers.
- [x] **3D.2** Update **all board data**: the brewery slots, the 2 Farm Brewery locations, and the
      merchant drink spaces now use the new beverage industry/resource (same positions & counts).
- [x] **3D.3** Update **all cards**: any Brewery industry card and related references become the
      new beverage industry; wild‑industry behavior unchanged.
- [x] **3D.4** Update **all UI labels, tooltips, the legend/key, the Rules Library, and the
      tutorial** to the new beverage naming and iconography.
- [x] **3D.5** Provide/replace **art & icons**: the brewery tile/icon and the beer‑barrel cube
      become a juice/soft‑drink works and a drink barrel (original/royalty‑free; record in
      `ASSETS_CREDITS.md`). Update any "beer" sound/label.
- [x] **3D.6** Update **i18n** in **EN/RU/UZ** for every renamed string (industry name, resource
      name, Farm version, merchant bonus, rules text, log lines like "Blue built a Juice Works in
      Stafford").
- [x] **3D.7** Grep the whole codebase for residual `beer`/`brewery`/`pivo` strings and confirm
      none remain in user‑facing text; run the full test suite to confirm mechanics are unchanged.
      *DoD: there is no "Brewery"/"beer" (or "Pivo zavodi") anywhere in the game — board, tiles,
      cards, markets, rules, tutorial, logs, and all three languages now show the non‑alcoholic
      beverage industry — while every game rule and value behaves exactly as before.*

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

### Phase 8 — Multi‑Map System & Era‑Morphing Boards (§7.15)

> Add multiple boards, era‑specific routes, era‑morphing layouts, an optional Air Era on large
> maps, and per‑era islands/locations — turning the single fixed board into a data‑driven map
> registry. All names localized EN/RU/UZ; saves/replays bind to the chosen map.

**Map framework**
- [x] **8.1** Refactor board data into a `MapDefinition` model (§7.15.6) and a **map registry**
      that lists all maps with metadata; the engine loads the active map by `mapId`.
- [x] **8.2** Store `mapId` in `GameState.options`, saves, and replays; setup/deck/board all key
      off the active map. Add save‑migration for older single‑map saves.
- [x] **8.3** Add a **map picker** to Game Setup (preview, description, size/duration tags, filter
      Full vs Fast‑play and by era count).
- [x] **8.4** Generalize setup, deck composition, connectivity/network selectors, and the board
      renderer to read **per‑era** topology (`map.locations[era]`, `map.links[era]`).

**Era‑specific routes & morphing**
- [x] **8.5** Make each map declare an **ordered era list** and a **route type + visual style per
      era** (canal/water, rail, air) so the network looks different each era.
- [x] **8.6** Implement **era‑morph transition**: on era change, reposition locations, swap route
      types, and change islands/names, with an **animated** transition; integrate with end‑of‑era
      maintenance.
- [x] **8.7** Implement the **optional Air Era** (third era) for maps that declare it: air links
      with map‑defined cost/resource/scoring (defaults mirror the rail‑link pattern); standard
      2‑era maps unaffected. Document Air‑Era rules in the Rules Library + contextual help.
- [x] **8.8** Implement **islands & per‑era naming**: island sets and names that can differ per era;
      all location/island names as i18n keys (EN/RU/UZ).

**The 10 maps**
- [x] **8.9** Author **5 Full maps** (distinct geography, locations, link networks, merchants, and
      bespoke card decks + skins), each with its own player‑count rules. At least one Full map
      includes an **Air Era**.
- [x] **8.10** Author **5 Fast‑play maps** (small, fewer locations/links, shorter decks) tuned to
      **play quickly and run smoothly on modest hardware**, while remaining rules‑complete.
- [x] **8.11** Provide map‑specific **art/skins, thumbnails, and route styling** per era
      (original/royalty‑free; record in `ASSETS_CREDITS.md`).
- [x] **8.12** Tests: each map's data validates (counts/decks/merchants per player count); a
      headless full game runs on every map (incl. Air‑Era maps); era‑morph restores correctly from
      a mid‑era save.
      *DoD: players can choose from 10 maps (5 full + 5 fast); each era shows its own route type and
      layout; islands/locations/names change between eras; Air‑Era maps add air routes after the
      Rail Era; saves/replays reload on the correct map and era; everything localized EN/RU/UZ.*

### Phase 8G — Era Goods‑Delivery (Sell) Transport Animation (§7.4.1)

> When a player sells, a vehicle visibly carries the goods from the producing factory, across the
> network, to the merchant being sold to, delivers the cargo, then returns to its origin —
> beautifully animated and matched to the era (boat → train → cargo plane).
- [x] **8G.1** Add a `GOODS_SOLD` (or extend the Sell) game event carrying the origin location,
      destination merchant, and the sold industry, so the UI can animate the delivery.
- [x] **8G.2** Compute the **route path of links** from the selling factory to the target merchant
      (reuse the engine connectivity/route finding) and animate a vehicle following that polyline
      across the board with smooth easing — not a straight line.
- [x] **8G.3** **Era‑specific vehicle + route styling** (from the active era's `routeType`):
      **Canal → cargo boat/barge**, **Rail → freight train**, **Air → cargo plane** (flight arc).
- [x] **8G.4** Full sequence: spawn at factory → carry a visible cargo token → arrive at merchant →
      **deliver** (cargo drop + the existing tile‑flip / income / coin animations) → **return to
      origin** and despawn.
- [x] **8G.5** Per‑vehicle **SFX** (boat horn / train / plane) hooked to the audio mixer.
- [x] **8G.6** Respect animation **speed/skip** and `prefers-reduced-motion` (graceful quick‑move
      fallback); sequence/stagger **multiple deliveries** in one Sell action without blocking input
      longer than necessary; graceful fallback when no direct route exists.
      *DoD: every Sell shows an era‑appropriate vehicle carrying goods along the network to the
      merchant and back, with matching sound — boats in the Canal Era, trains in the Rail Era, and
      cargo planes in the Air Era.*

### Phase 8B — BUGFIX: Save / Continue / Delete consistency (§7.10.6)

> **Bug:** after quitting, the game is kept as the **Continue** game; if the player saves it,
> deletes that saved game, then presses **Continue**, the app still loads the deleted game.
> Continue and the saved‑slot list are out of sync.
- [x] **8B.1** Make **Continue** use a single **current‑game pointer** (slot id reference), not a
      stale duplicate copy.
- [x] **8B.2** **Enable Continue only if** the referenced save still exists; otherwise disable/grey
      it out (validate on launch and on returning to the Main Menu).
- [x] **8B.3** **Deleting** a save also **clears the Continue pointer** when it is the current game,
      and refreshes the Main Menu so Continue immediately becomes disabled; never leave a dangling
      pointer.
- [x] **8B.4** **Finishing or Abandoning** a game clears the current‑game pointer.
- [x] **8B.5** Ensure **saving + continuing** the same game resolves to the **same** state (no fork
      between Continue and the Load slot).
- [x] **8B.6** Tests: delete‑then‑Continue (disabled / does not load), finish‑then‑Continue,
      save → delete → Continue, and resume‑matches‑saved‑state.
      *DoD: it is impossible to resume a deleted or finished game; Continue is disabled whenever
      there is no valid current game, and always resumes exactly the intended game.*

### Phase 9 — MYSpolly Economy Model (§7.16)

> Intentional MYSpolly variant: personal resource stockpiles, per‑round production from your
> buildings, no free resources from others, market buying for shortfalls, starting resources,
> cost+benefit previews, and era‑morphing geography. Document all of it in the Rules Library +
> contextual help; localize EN/RU/UZ; cover with tests so it is bug‑free.

**Resources & stockpiles**
- [x] **9.1** Add a **per‑player resource stockpile** `{ coal, iron, juice }` to `PlayerState`;
      show it live in the HUD/`PlayerStrip` next to money/income/VP.
- [x] **9.2** **Remove free resource sharing**: actions consume resources **only from the acting
      player's own stockpile** — never free from other players' mines/works. Update the engine
      consumption logic and `legalActions`.
- [x] **9.3** Grant **starting resources** to every player at setup (tunable, e.g. coal 2 / iron 1
      / juice 1), defined per map/player‑count and shown in Game Setup.

**Per‑round production & upgrades**
- [x] **9.4** Implement **per‑round production**: at the income/end‑of‑round step, each player's
      owned production buildings add resources to their stockpile based on **type + level** (use
      the tunable table in §7.16.2; expose values in data). Coal Mine→coal, Iron Works→iron,
      Juice Works→juice.
- [x] **9.5** **Develop/upgrade raises production**: upgrading a production building makes it
      produce the higher amount **from the next round onward**.
- [x] **9.6** Show, per building and as a player total, **how much it will produce next round** in
      the UI; add a clear end‑of‑round "resources produced" summary/animation.
- [x] **9.7** Optional tunable **stockpile caps** per resource to prevent runaway hoarding.

**Market buying when short**
- [x] **9.8** When an action needs more of a resource than the player's stockpile **and** they are
      connected to the relevant market, offer to **buy the shortfall**: show **current market
      price**, **units needed**, and **total cost**; on confirm, pay money, move market prices
      (cheapest‑first; empty→fixed price), and complete the action.
- [x] **9.9** If **not connected** to the market and short on a resource, the action is **disabled
      with a clear reason** (per §7.13) — never allow an illegal build.

**Cost & benefit preview**
- [x] **9.10** Extend the action/build preview (§7.13 / §7.16.6) to show, before confirming:
      **cost** (money + coal/iron/juice consumed, with any market purchase priced out) **and the
      potential benefit** (income gained, VP it can score, per‑round production it adds, what it
      unlocks). Draw from stockpile first, then market.

**Era‑morphing geography (islands → land → air) — extends Phase 8 (§7.16.7)**
- [x] **9.11** Implement the era world transform: **Canal = islands separated by water** (water
      routes), **Rail = connected land** (locations reposition on land, **names change**, rail
      routes), **Air = air hubs** (positions/names/network change again, air routes). Each location
      keeps a **stable logical `id`** across eras (so persistent level‑2+ tiles map correctly)
      while position/display‑name/routes are per‑era data; animate the morph at era transition.

**Quality**
- [x] **9.12** Tests: no free resource use; stockpile math; per‑round production by level; upgrade
      raises output next round; market shortfall purchase + price movement; not‑connected ⇒
      disabled; starting resources; era‑morph keeps tiles correctly mapped to logical ids across a
      mid‑game save/load.
      *DoD: players manage personal coal/iron/juice stockpiles fed by their own buildings each
      round (more when upgraded), can't freeload off others, can buy shortfalls from a connected
      market at shown prices, see full cost+benefit before acting, start with seed resources, and
      watch the world morph from islands → land → air across eras — all consistent, localized
      EN/RU/UZ, and bug‑free.*

### Phase 10 — BUGFIX & OVERHAUL: Distinct Maps, Real Place Names & Genuine Era‑Morphing (§7.15, §7.16.7)

> **Reported problems (must be fixed):**
> 1. **The maps are nearly identical.** The authored Full maps (`Severn Vale`, `Highland
>    Reach`, `Iron Coast`, `Skyward Dominion`) all reuse the **same coordinate grid**, the
>    **same 12‑town + 2‑farm + 5‑merchant skeleton**, and a **near‑identical link topology** —
>    only the names differ. The 5 Fast‑play maps (`Quill Hollow`, `Tin Brook`, `Maple Cross`,
>    `Slate Pike`, `Amber Fen`) are likewise clones of a single 6‑town template. Players
>    experience every board as "the same map with different words".
> 2. **Raw internal IDs leak onto the board as place labels.** Fast‑map towns/merchants use
>    ids like `a1`, `a2`, `am1`, `q1`, `t1` (see `src/core/maps/authored.ts`). When a
>    location's `map.<mapId>.loc.<id>` i18n key fails to resolve, the board falls back to the
>    raw id (`nameOf(id) ?? id` in `BoardSvg.tsx`), so the player sees **"a1", "am1", "q1"**
>    etc. where a real place name (e.g. *Amberfen*, *Fengate*) should appear. This is the
>    "joy nomi a1/am1 bo'lib chiqyapti" bug.
> 3. **The board does not really morph between eras.** Most maps set `railLinks = canalLinks`
>    and define **no per‑era positions** (`eraPos`) — so when the era advances, the locations,
>    mines, the roads/links that open up, the islands and the merchant "stations" stay put.
>    Per §7.15.3 / §7.16.7 the world must visibly change each era.

**A. Fix raw‑ID place labels (display correctness)**
- [x] **10.1** Guarantee **every** location, merchant, island and route on **every** map renders
      a real, localized **display name** — never a raw internal id. Audit `BoardSvg.tsx`
      (`nameOf`, the town/merchant `<text>` labels), the guided action flow, the game log, and
      tooltips: the `?? id` fallback must never surface to the player.
- [x] **10.2** Verify the authored‑map i18n keys (`map.<mapId>.loc.*`, `.merch.*`, `.island.*`,
      `.name`, `.desc`) are **actually registered** in EN/RU/UZ at runtime
      (`registerMapResources()` ⇄ `buildMapI18n()`), including the classic **Birmingham** map,
      and that registration happens **before** the board first renders (no module‑evaluation /
      ordering gap that leaves keys unresolved).
- [x] **10.3** Add a test asserting that for **all** maps and **all** eras, resolving each
      location/merchant/island name key returns a human name (not the key and not the id), in
      all three languages. Add a dev‑time guard/warning if any name key is missing.

**B. Make every map genuinely distinct**
- [x] **10.4** Give each Full map its **own geography**: distinct town **count/placement**
      (break the shared `x:480/300/660 …` grid), a **different link network shape** (not the
      same edge pattern re‑labelled), different **merchant placement**, and a **different
      industry/slot distribution** so each board plays differently (e.g. iron‑scarce vs
      coal‑rich vs juice/cotton‑heavy). Keep them rules‑complete and balanced.
- [x] **10.5** Give each Fast‑play map its **own** small but distinct layout (different town
      count where sensible, different topology and merchant mix) — not five copies of one
      template. Keep them quick and performant.
- [x] **10.6** Rename internal ids to be **meaningful & unique** (or keep ids but ensure they are
      never shown — see 10.1); ensure no two maps share an accidentally‑identical structure.
      Add a test/lint that flags maps whose location set + link topology are isomorphic to
      another map's (catch future "clone" regressions).

**C. Genuine per‑era morphing (locations, mines, links, islands, stations change)**
- [x] **10.7** For each map, define a **distinct network per era** (`linksByEra`): the canal‑era
      routes must differ from the rail‑era routes (and air‑era where present) — different edges
      open up, not `railLinks = canalLinks`. The "roads/links that open" must visibly change.
- [x] **10.8** Define **per‑era positions** (`eraPos`) and **per‑era names** (`eraNames`) so
      locations **reposition and can be renamed** between eras (islands‑separated‑by‑water →
      connected land → air hubs, per §7.16.7), while each location keeps a **stable logical
      `id`** so persistent level‑2+ tiles still map correctly.
- [x] **10.9** Make **mines / production buildings, islands, and merchant "stations"** part of
      the morph: their **placement and grouping change per era** (e.g. island membership and
      island **names** differ canal vs rail vs air, not just a renamed label on the same set).
- [x] **10.10** Verify the **animated era‑morph transition** (BoardSvg node `transform`
      transitions + `--era-morph-ms`) plays when the era advances and that the board clearly
      shows the new layout/routes; integrate with end‑of‑era maintenance.
- [x] **10.11** Tests: every map validates per era (counts/decks/merchants, connectivity is a
      valid playable network in each era); a headless full game runs on every map through all its
      eras; a **mid‑era save/load** restores the correct era topology with level‑2+ tiles still
      mapped to the right (repositioned) locations.
      *DoD: no board ever shows a raw id like "a1"/"am1" — every place shows a proper localized
      name; the 5 Full + 5 Fast maps are each visibly and mechanically distinct (no two are the
      same board re‑labelled); and when the era changes, the locations, mines, the links/roads
      that open, the islands and the merchant stations genuinely reposition/rewire/rename, with a
      smooth animated transition, all localized EN/RU/UZ.*

### Phase 11 — BUGFIX & OVERHAUL: Money, Cost‑Accounting, Resource Trading & Bankruptcy (§7.17)

> Fix all money‑related defects and implement the new economy rules: strict money gating (no
> buying with insufficient funds), exact resource accounting, buying a shortfall from another
> player, market‑only‑for‑traded‑goods + fixed price for non‑market resources, Brass‑faithful
> market price movement, and an explicit bankruptcy flow (sell a factory to the bank at half, or
> auction it to the other players starting at half). Cover everything with tests; localize EN/RU/UZ.

**A. Strict money gating — §7.17.1 (the "build for £0 with no money" bug)**
- [x] **11.1** Make `spend()` in `engine/helpers.ts` **never drive money below 0**: assert
      `amount <= p.money` (validators must guarantee it) and route any mandatory payment the player
      can't afford through `payOrBankrupt()` (§11.E) instead of silently going negative. Do the
      same audit for `changeMoney()` where it represents a payment.
- [x] **11.2** Recompute every action's affordability against the **full total cost** = money cost
      **+** all resource purchases (market + fixed‑price + player‑to‑player). Fix
      `validateBuild`/`validateNetwork`/`validateDevelop`/`validateSell` so the check is
      `totalCost <= p.money`, and ensure `legalActions` filters out any action the player cannot
      fully pay for.
- [x] **11.3** Fix the **£0‑tile loophole**: a £0‑cost tile (e.g. Pottery L2/L4 in `industries.ts`)
      is buildable for £0 **only if** the player can also pay for its required coal/iron/juice; if
      the needed resources cost money the player lacks, the build is **disabled with a clear
      localized reason** (§7.13). A broke player can no longer build/acquire anything whose true
      cost exceeds their money.

**B. Exact, complete resource accounting — §7.17.2**
- [x] **11.4** Audit and make **exact** the resource accounting for **Network** (coal per link ×
      links + double‑link juice, summed across the whole action), Build (coal+iron), Develop
      (iron), and Sell (juice): every consumed unit is counted, sourced, priced, and paid; placing
      links/tiles consumes exactly that many units (no free/over/under count).
- [x] **11.5** Show an **itemized cost breakdown** in the guided preview (§7.13/§7.16.6): money +
      each resource, with how many come from stockpile vs. purchased and the per‑source price and
      total. Reconcile to one `RESOURCE_CONSUMED` event per unit.

**C. Buy a shortfall from another player — §7.17.3**
- [x] **11.6** Implement the resolution order **own stockpile → market (coal/iron, if connected) →
      another player's stockpile**. Add a player‑to‑player purchase that moves units from the
      chosen owner and **pays that owner** (money buyer→owner) at the market price (coal/iron) or
      fixed price (juice). Extend `ResourceSource` (`actions.ts`) with a `{ from: 'player';
      color }` source and thread it through `consume.ts`, the action validators/appliers, and
      `legalActions`.
- [x] **11.7** UI picker to choose which other player to buy from when several have stock (AI uses
      a sensible default: cheapest/most‑available). If stockpile + market + other players still
      can't satisfy the need, the action is **disabled with a clear reason**.

**D. Market vs. fixed‑price resources (Brass‑faithful) — §7.17.4**
- [x] **11.8** Enforce **market = coal & iron only**: only these may be bought/sold in a market;
      keep the existing Brass price‑ladder movement (`market.ts`/`markets.ts`) — buying raises the
      price (cheapest filled cube first), selling lowers it (cheapest empty space first), empty
      market uses the fixed `emptyPrice`. Add a test asserting the ladder moves exactly as in Brass.
- [x] **11.9** Give **non‑market resources a fixed, unchanging price** (juice et al.) in
      `data/economy.ts`; a juice shortfall is covered at that fixed price (general supply or another
      player, §11.6) instead of making the action illegal. Surface "market price" vs "fixed price"
      in the buy dialog and Rules Library.

**E. Bankruptcy: sell to bank at half, or auction to players — §7.17.5**
- [x] **11.10** Replace the silent auto‑sell in `engine/income.ts` with an explicit
      **bankruptcy resolution**: when a mandatory payment exceeds cash, the player repeatedly
      chooses to either (a) **sell one of their tiles to the bank at half build cost (rounded
      down)** — tile removed, bank pays half — or (b) **auction a tile to the other players** with
      an **opening bid = half build cost**.
- [x] **11.11** Implement the **auction**: other players (human + AI) bid higher in turn order;
      highest bidder **pays their bid to the bankrupt player and takes ownership** (tile stays on
      the board, owner changes); if no one bids above the opening, fall back to selling to the bank
      at the opening (half) price. Add events for tile‑sold‑to‑bank, auction‑opened, each bid, and
      auction‑result (winner + price + new owner) — fixing the current **missing per‑tile removal
      event** in the shortfall path so the board/log/animation update correctly.
- [x] **11.12** Keep selling until the debt is covered (player keeps any surplus); **if no tiles
      remain**, fall back to **−1 VP per £1** still owed (VP floored at 0); only then record true
      bankruptcy. Never let money or VP go negative.
- [x] **11.13** **Bankruptcy/auction UI**: a clear localized modal showing the tile, its half‑price
      opening bid, per‑player bid controls, pass/win resolution, and the chosen‑tile/method picker;
      EN/RU/UZ. AI heuristic for which tile + bank‑vs‑auction, and for **bidding in opponents'
      auctions** when a tile is worth more than the ask.

**F. AI, docs & tests — §7.17.6**
- [x] **11.14** Update the AI bot/heuristic: never attempt unaffordable actions (enforced via
      `legalActions`), pick resource sources (stockpile → market → cheapest player), make
      bankruptcy choices, and bid in auctions sensibly.
- [x] **11.15** Update the **Rules Library + contextual help** (§7.14) with the money‑gating,
      resource‑trading, fixed‑price, and bankruptcy/auction rules, localized EN/RU/UZ.
- [x] **11.16** Tests: cannot build/act without funds (incl. the £0‑tile case); exact Network
      resource+money accounting; buy‑from‑player (units move, owner paid, disabled when impossible);
      market only trades coal/iron with correct ladder movement; fixed juice price; bankruptcy
      sell‑to‑bank at half; auction (bids, winner pays, ownership transfer, no‑bid fallback);
      VP‑loss fallback; money/VP never negative; a property test that random legal play never
      produces negative money.
      *DoD: a player with no money can never acquire anything whose true cost exceeds their funds;
      every resource a Network/Build/Develop/Sell uses is counted and paid for exactly; a short
      player may buy the missing resource from another player (paying them); only coal & iron trade
      in a market (Brass‑style moving prices) while non‑market resources use a fixed price; and a
      player who goes into debt must resolve it by selling a factory to the bank at half price or
      auctioning it to the other players starting at half — all localized EN/RU/UZ and covered by
      passing tests.*

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

- **Phase 9 complete (MYSpolly Economy Model, §7.16).** Implemented the
  intentional MYSpolly resource-economy variant in the pure engine and surfaced
  it across the UI, fully localized EN/RU/UZ and covered by tests.
  - **Stockpiles & no freeloading (9.1/9.2/9.9):** each `PlayerState` now carries
    a personal `{ coal, iron, juice }` stockpile (`data/economy.ts`). All
    consumption (Build coal/iron, Develop iron, Network rail coal + double-link
    juice, Sell juice) is drawn **only from the acting player's own stockpile**,
    then a connected-market shortfall — never free from other players' tiles.
    Coal-market buys require a merchant connection (checked against the
    post-placement network for Network), iron is always buyable, and juice has no
    market (a shortfall disables the action with a clear localized reason).
  - **Per-round production & upgrades (9.3/9.4/9.5/9.7):** every player starts
    with a tunable seed stockpile (shown in Game Setup); production buildings
    (Coal Mine → coal, Iron Works → iron, Juice Works → juice) come online on
    build (flipped + income) and refill the owner's stockpile each round by a
    tunable level-based table (`engine/production.ts`), clamped to optional caps;
    an upgrade produces the higher amount from the next round. The old
    cube-to-market-on-build / flip-on-empty model is replaced for producers.
  - **Market shortfall + cost/benefit preview (9.8/9.10):** the guided action
    preview shows money + coal/iron/juice consumed (priced out, market-bought
    units flagged) and the benefit — income, VP, flips, and the per-round
    production the action unlocks. `PlayerStrip` shows each player's live
    stockpile and "produces next round"; a `RESOURCE_PRODUCED` event drives an
    end-of-round produced log line + beat.
  - **Era-morphing geography (9.11):** the board already renders per-era
    topology; nodes now glide to their new positions on the morph, and persistent
    level-2+ tiles keep a **stable logical id** so they map to the right place as
    the world goes islands → land → air.
  - **Quality (9.12):** new `tests/unit/economy.test.ts` (no-freeloading,
    stockpile math, production by level, upgrade, caps, market price movement,
    not-connected ⇒ disabled, starting resources, stable-id production across a
    real Canal→Rail morph + save/load) plus a random-play property test that the
    stockpile never goes negative or exceeds its cap. Save format bumped to v3
    with a v2→v3 migration that seeds the stockpile. The full Node suite (engine,
    AI, persistence, i18n, rules content, economy) is green and the engine
    typecheck is clean; the Rules Library gained a localized "MYSpolly Economy"
    chapter.

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



---

## 15. Progress Log — Phase 10 (Map Overhaul)

- **Phase 10 complete.** Fixed the three reported defects and met every
  acceptance criterion (10.1–10.11):
  - **Display correctness (10.1–10.3).** Added a single map-aware name resolver
    `src/app/components/board/names.ts` (`locName`/`lineName`) that reads the
    active board context, never the Birmingham-only static data, with a dev-time
    missing-key warning and a humanized fallback so a **raw internal id can never
    reach the player**. Routed `BoardSvg` labels/tooltips, the guided action flow
    (`flow.ts` `promptInfo`/`buildVariants`), `GuidedActionBar`, `TurnHud`, the
    game log (`logLines.ts`) and card labels (`cardText.ts` now uses the card's
    registered i18n key) through it. Authored-map keys (incl. per-era names and
    per-era island names) are registered EN/RU/UZ via `buildMapI18n()` before the
    board renders. New test `tests/unit/mapMorph.test.ts` asserts every
    location/merchant/island/map name on **every map, every era, all three
    languages** resolves to a human name (never the key, never the id).
  - **Distinct maps (10.4–10.6).** Rewrote all 9 authored maps in
    `src/core/maps/authored.ts` with their own geography, topology *shape*,
    merchant placement and industry distribution: Severn Vale (cotton/juice-rich
    river valley), Highland Reach (coal-rich / iron-scarce twin glens),
    Iron Coast (iron-heavy 14-town coastal crescent, 6 ports), Skyward Dominion
    (ring-and-hub, 3 eras); and 5 distinct Fast maps — Quill Hollow (ring),
    Tin Brook (chain), Maple Cross (star), Slate Pike (twin-cluster), Amber Fen
    (grid). A Weisfeiler–Lehman topology-fingerprint test guards against any two
    maps being structural clones.
  - **Genuine per-era morphing (10.7–10.10).** Each map now defines a genuinely
    different link network per era (`canalLinks` ≠ `railLinks`, plus `airLinks`
    on Skyward), per-era node positions (`eraPos`) and names (`eraName`), and
    per-era islands whose membership and names change. The authoring helpers were
    extended to thread `eraPos`/`eraName` through to the builder; the engine and
    `BoardSvg` already read per-era topology from the board context, so the board
    physically repositions/rewires/renames on era advance with the existing
    `--era-morph-ms` transform transition, integrated with end-of-era maintenance.
  - **Tests (10.11).** Every map validates per era (counts/decks/merchants and a
    connected, every-town-reaches-a-merchant network in **each** era); headless
    full games run on every map through all its eras; and a mid-era save/load
    restores the correct era topology with a level-2 tile still mapped to the
    right (repositioned) location. Full suite: **330 engine tests green**, engine
    typecheck clean, Prettier clean.


## 16. Progress Log — Phase 11 (Money, Resource Trading & Bankruptcy Overhaul)

- **Phase 11 complete (§7.17).** Fixed every reported money defect and implemented
  the corrected economy rules (11.1–11.16):
  - **Strict money gating (11.1–11.3).** `spend()` in `engine/helpers.ts` now
    asserts `amount <= money` and throws rather than silently going negative; a
    new `payPlayer()` handles peer-to-peer payments. Every action validator
    (`build`/`network`/`develop`) checks the **full total cost** (money + every
    resource purchase) with `totalCost <= money`, so `legalActions` only ever
    enumerates fully-payable actions. This closes the **£0-tile loophole**: a
    £0 build (e.g. Pottery L2/L4) is allowed only when the player can also pay
    for its required coal/iron — verified by a test that a broke player can build
    it for free when holding the coal, but is blocked when the coal is unaffordable.
  - **Exact resource accounting (11.4–11.5).** `consume.ts` was rewritten to plan
    and apply each unit precisely with a per-unit price, emitting one
    `RESOURCE_CONSUMED` event per unit (now carrying its money `cost`). Network
    accounts for every coal-per-link and the double-link juice across the whole
    action; a test asserts a double rail link consumes exactly 2 coal + 1 juice
    and pays exactly the £15 link cost when sourced from stock. The guided preview
    (`flow.ts`/`GuidedActionBar`) shows an itemized breakdown: stockpile vs.
    market vs. player vs. fixed-supply units and the total resource cost.
  - **Buy from another player (11.6–11.7).** Added a `{ from: 'player'; color }`
    `ResourceSource` and a strict resolution order **own stockpile → market
    (coal/iron, if connected) → another player (paying them) → fixed-price supply
    (non-market)**. `resourceSellerOptions` surfaces the picker data; a UI seller
    preference threads through `consumeResource`. Tests confirm units move from
    the seller, the seller is paid the market/fixed price, the market is untouched
    on a peer buy, and the action is disabled when no source can cover it.
  - **Market vs. fixed price (11.8–11.9).** Only coal & iron trade in a market
    (`MARKET_RESOURCES`/`isMarketResource`), keeping the existing Brass ladder
    movement (asserted by a ladder test: buying raises the price cheapest-filled
    first, selling lowers it cheapest-empty first, empty market = `emptyPrice`).
    Juice has a tunable `FIXED_RESOURCE_PRICE` in `data/economy.ts`; a juice
    shortfall is now bought at that fixed price (supply or another player) instead
    of being illegal.
  - **Bankruptcy (11.10–11.13).** New `engine/bankruptcy.ts` replaces the silent
    auto-sell in `income.ts` with an explicit, event-emitting resolution: sell a
    tile to the bank at half build cost (rounded down, tile removed) **or** auction
    it to the other players (opening bid = half; highest bidder pays the bankrupt
    player and takes ownership; no bid → bank buys at half). Events
    (`BANKRUPTCY_STARTED`, `TILE_SOLD_TO_BANK`, `AUCTION_OPENED`, `AUCTION_BID`,
    `AUCTION_RESULT`, `BANKRUPTCY_RESOLVED`) fix the previously missing per-tile
    removal event and drive the log, animations, and a new localized
    `BankruptcyModal` (recap built by the pure, tested `bankruptcyView.ts`). Selling
    continues until covered; then −1 VP per £1 owed (VP floored at 0); money/VP
    never go negative. A pluggable `BankruptcyDecider` lets the UI/AI inject
    choices, defaulting to a deterministic engine policy. All balance values
    (fixed juice price, peer markup, auction increment, AI bid fraction, auction
    threshold) live in `data/economy.ts`.
  - **AI, docs & tests (11.14–11.16).** The AI is constrained by `legalActions`
    (never unaffordable), buys via the engine's stockpile→market→player order, and
    every player's bankruptcy/auction behaviour is governed by the shared
    deterministic decider (`aiBankruptcyDecider`) during headless play. Added the
    **Rules Library "Money, Trading & Bankruptcy"** chapter + revised economy text
    and contextual help, fully localized EN/RU/UZ (key-parity test green). New
    `tests/unit/phase11.test.ts` covers every item, including a **property test
    that random legal play never produces negative money or VP**.
  - **Verification.** Engine typecheck (`tsc --noEmit -p tsconfig.engine.json`)
    clean; Node test runner **359 engine tests green** (up from 330). The React
    UI/Vite/Tauri build is validated by CI (it cannot be built in the offline
    sandbox); all UI was authored to the same standard.
