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
- [ ] **0.1** Initialize project: `pnpm create vite` (React + TS), commit baseline. *DoD: dev server runs.*
- [ ] **0.2** Configure strict `tsconfig`, ESLint, Prettier, EditorConfig. *DoD: lint passes on empty project.*
- [ ] **0.3** Install deps: zustand, framer-motion, gsap, howler, i18next, react-i18next, idb, immer. Add Vitest + RTL + Playwright.
- [ ] **0.4** Set up folder structure per §5; add path aliases (`@core`, `@app`).
- [ ] **0.5** GitHub Actions CI: install → typecheck → lint → test on PR. *DoD: green CI on a trivial test.*
- [ ] **0.6** Create `ASSETS_CREDITS.md` and an `/public/assets` placeholder structure.
- [ ] **0.7** Add a global theme system (CSS variables) supporting Day/Night palettes.

### Phase 1 — Static Game Data (the "rules data")
- [ ] **1.1** Extract the **board graph** from the rulebook/board: every location id, display name,
      colour band, and the merchant locations. *DoD: all locations enumerated & typed.*
- [ ] **1.2** Extract every **link line** (which two locations it connects; canal/rail/both).
- [ ] **1.3** Extract each location's **industry slots** and which industry icons each slot allows.
- [ ] **1.4** Encode the **9 merchant tiles** with their industry icons + beer bonus type, plus the
      player‑count placement rules (2P: no Warrington/Nottingham; 3P: no Nottingham; 4P: all).
- [ ] **1.5** Encode **per‑industry, per‑level stats**: cost, coal cost, iron cost, beer‑to‑sell,
      VP, income spaces, link VP contribution, cubes produced, era buildability, developable flag,
      lightbulb potteries. *DoD: matches the player‑mat printouts exactly.*
- [ ] **1.6** Encode the **card deck** composition for 2/3/4 players (location cards, industry
      cards, counts), plus Wild Location/Industry piles.
- [ ] **1.7** Encode **coal & iron market** price ladders, capacities, and empty‑market prices.
- [ ] **1.8** Encode **setup parameters** (starting money £17, income level 10, hand size 8,
      tile stacks per colour, removed cards/merchants per player count).
- [ ] **1.9** Write a **data validation test** (counts add up: 45 tiles/colour, 14 links/colour,
      30 coal, 18 iron, 15 beer, merchant counts, deck sizes). *DoD: validation test passes.*

### Phase 2 — Pure Game Engine
- [ ] **2.1** Define model types (`state.ts`, `actions.ts`, `events.ts`) per §6.
- [ ] **2.2** Implement seeded RNG (`rng.ts`) and a deterministic shuffle.
- [ ] **2.3** Implement `buildInitialState(options, seed)` (full setup incl. player‑count rules).
- [ ] **2.4** Implement connectivity selectors: graph build, `connected`, `distance`, `network`.
- [ ] **2.5** Implement resource routing: `coalOptions`, `ironOptions`, `beerOptions`, cost calc,
      and market price computation.
- [ ] **2.6** Implement **Build** action incl. slot rules, payment, coal/iron consumption,
      cube‑to‑market movement, brewery beer placement, tile flips, overbuilding rules,
      "no tiles on board" case, and Farm Breweries.
- [ ] **2.7** Implement **Network** action (Canal £3×1; Rail £5×1 or £15×2+beer; coal per rail link).
- [ ] **2.8** Implement **Develop** action (1–2 removals, iron per removal, lightbulb restriction).
- [ ] **2.9** Implement **Sell** action (merchant matching, beer consumption from all sources,
      merchant beer bonuses, multi‑tile sells, flips + income).
- [ ] **2.10** Implement **Loan** (+£30, −3 income levels, −10 floor) and **Scout** (discard+2,
      wild restriction) and **Pass**.
- [ ] **2.11** Implement card discard/refill, action counting (1 in first Canal round else 2),
      and spent‑money tracking on character tiles.
- [ ] **2.12** Implement **end of round**: turn‑order re‑sort + income collection incl. negative
      income, shortfall tile‑selling (half cost rounded down), and VP loss fallback.
- [ ] **2.13** Implement **end of era scoring** (links by adjacent VP icons; flipped tiles' VP).
- [ ] **2.14** Implement **end of Canal Era maintenance** (remove level‑1 board tiles, reset
      merchant beer, reshuffle discards, redraw hands) and the **Canal→Rail** transition.
- [ ] **2.15** Implement **game over** + ranking with tiebreaks (VP → income → money → draw).
- [ ] **2.16** Implement the **introductory variant** scoring (Canal‑only + bonus scoring).
- [ ] **2.17** Implement `legalActions(state, player)` enumerating all legal moves (drives UI + AI).
- [ ] **2.18** **Engine test suite**: unit tests for every action + all §3 edge cases.
- [ ] **2.19** **Golden game test**: scripted full 2P/3P/4P games with asserted final scores.
- [ ] **2.20** **Property test**: random legal play for N turns never throws / never corrupts state.
      *DoD: M2 reached — a complete game is playable headlessly via code.*

### Phase 3 — UI: Interactive Board & Hot‑seat Play
- [ ] **3.1** Zustand UI store wrapping the core: `dispatch(action)`, exposes state + event
      stream, **plus a separate `AppScreen` navigation state** (see §7.10.1). The pure
      `GameState` and the UI/navigation state are kept distinct.
- [ ] **3.2** Screen router + transitions implementing the full state machine in §7.10.1
      (Splash → Main Menu → Setup/Load/Settings/Rules/Credits → Game ↔ Pause → Results/Replay).
      **The app must always open to the Main Menu and never auto‑start a game.**
- [ ] **3.3** **Splash screen**: branded logo + asset/saved‑data preload, skippable, auto‑advances
      to Main Menu only (never into a game).
- [ ] **3.4** **Main Menu screen** (§7.10.2): Continue, New Game, Load Game, Settings, How to Play,
      Credits, Quit. **Continue is enabled only when an autosave exists** (greyed out otherwise,
      with a tooltip + last‑session summary on hover). Keyboard/gamepad navigable, localized,
      animated background + menu music.
- [ ] **3.5** **GameSetup screen**: player count (2–4), human/AI per seat + AI difficulty,
      colours, board side (Day/Night), language, intro‑variant toggle; Start + Back to Menu.
      If an autosave exists, confirm before starting a new game (preserve the existing save).
- [ ] **3.6** **Settings screen** (§7.10.3): language, audio volumes + mute, animation speed +
      reduced‑motion, board side/zoom/colour‑blind palette, gameplay toggles, data management
      (manage/rename/delete slots, export/import, reset). Reachable from Main Menu **and** Pause
      Menu; persists immediately and applies live.
- [ ] **3.7** **Save/Continue/Load system** (§7.10.4): autosave each turn + at round/era
      transitions to the "current game" slot; **Continue** loads it; **Load Game** screen lists
      named slots with metadata + thumbnail; load validates save `version` and restores exactly
      (including mid‑turn). Delete/overwrite require confirmation.
- [ ] **3.8** **Pause Menu** (§7.10.5): Esc/Pause overlay with Resume, Settings, Save Game,
      How to Play, Save & Quit to Main Menu, Abandon Game (confirm). Game state untouched.
- [ ] **3.9** **Rules / How‑to‑Play screen** and **Credits screen** (localized, asset attribution).
- [ ] **3.10** **BoardSvg**: render locations, link lines, merchants from data; responsive zoom/pan.
- [ ] **3.11** **IndustryTile** & **LinkTileView** components (level/owner/flipped faces, resources).
- [ ] **3.12** **PlayerMat**: stacked tiles with costs, income track, VP track per player.
- [ ] **3.13** **Hand** + **DiscardPile**: render cards, select for actions.
- [ ] **3.14** **Coal/Iron Market** panels + merchant beer indicators.
- [ ] **3.15** **TurnOrderTrack** with spent‑money display.
- [ ] **3.16** **ActionBar**: 7 actions, disabled when illegal (from `legalActions`).
- [ ] **3.17** **Guided action flows** (pick card → target → resource choices → confirm) with a
      live **cost preview** (money/coal/iron/beer). Cancel at any step.
- [ ] **3.18** Legal‑placement highlighting on the board (valid slots/lines for current action).
- [ ] **3.19** **Game log** panel + on‑board tooltips (i18n keys).
- [ ] **3.20** End‑of‑round / end‑of‑era / **Results** screens with score breakdowns, plus
      Rematch (prefilled setup), Main Menu, and View Replay options.
      *DoD: M3 reached — a full hot‑seat 2P game is playable in the browser, always starting from
      the Main Menu, with working New Game / Continue / Load / Settings.*

### Phase 4 — Animations, Audio, i18n
- [ ] **4.1** Event→timeline mapping + a sequential animation queue (speed setting, skippable).
- [ ] **4.2** Animate: tile placement, link placement, cube‑to‑market + coin flow, tile flips,
      income/VP marker movement, card draw/discard, turn handoff.
- [ ] **4.3** Era transition cinematic (Canal→Rail) and end‑game victory sequence.
- [ ] **4.4** `prefers-reduced-motion` + "fast animation" support.
- [ ] **4.5** Audio engine (Howler): SFX sprite + music tracks; mixer with volumes/mute (persisted).
- [ ] **4.6** Hook SFX to events; ambient music per era; menu music.
- [ ] **4.7** i18n scaffold (i18next) + extract **all** strings to keys.
- [ ] **4.8** Author **EN** bundle (complete), then **RU** and **UZ** bundles incl. board/rules
      terminology; maintain `glossary.md`. Runtime language switch.
- [ ] **4.9** Number/currency formatting per locale; verify RU/UZ layouts don't overflow.
      *DoD: M4 reached — fully animated, voiced (SFX), tri‑lingual game.*

### Phase 5 — AI, Variant, Replays (menus & persistence already done in Phase 3)
- [ ] **5.1** Bot interface + Easy heuristic bot (greedy over `legalActions`).
- [ ] **5.2** Normal bot (1‑turn look‑ahead) and Hard bot (light MCTS/beam search).
- [ ] **5.3** Bot "thinking" pacing + per‑seat difficulty selection in setup.
- [ ] **5.4** Harden the Phase‑3 Save/Load: save‑version migration, slot thumbnails, mid‑turn
      autosave integrity, and quota/error handling.
- [ ] **5.5** Extend Settings with AI‑specific options (thinking speed, auto‑skip AI animations).
- [ ] **5.6** Replay storage (seed + action log) + a basic replay viewer (from Results screen).
- [ ] **5.7** Wire up the **introductory variant** end‑to‑end in the UI.
      *DoD: M5 reached — fill empty seats with AI; games are saveable/resumable.*

### Phase 6 — Desktop Packaging & Release
- [ ] **6.1** Add **Tauri 2** shell (`src-tauri/`), load the web build, native window + menus.
- [ ] **6.2** Native Save/Load file dialogs via Tauri FS; app data dir for autosave/settings.
- [ ] **6.3** App icon, product name "MYSpolly", window sizing, fullscreen toggle.
- [ ] **6.4** Build installers: Windows `.exe` (NSIS/MSI), macOS `.dmg`, Linux `.AppImage`/`.deb`.
- [ ] **6.5** Document **Electron fallback** path (scripts + build) for environments without Rust.
- [ ] **6.6** CI: build + upload desktop artifacts per OS on tagged releases.
- [ ] **6.7** Performance/QA pass (60 fps board, memory, load time) + bug‑fix sweep.
- [ ] **6.8** Finalize `ASSETS_CREDITS.md`; confirm no shipped assets infringe copyright.
      *DoD: M6 reached — installable desktop game on all three OSes.*

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
