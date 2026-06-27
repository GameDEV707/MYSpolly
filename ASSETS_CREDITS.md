# Asset Credits & Attribution

> **MYSpolly** is a personal, non-commercial fan implementation of
> **Brass: Birmingham** (© 2018 Roxley Games, design by Martin Wallace).
>
> No original publisher artwork, fonts, icons, sounds, or music are shipped with
> this project. Every visual and audio asset in the final build is one of:
> (a) **original**, created for this project,
> (b) **properly licensed**, or
> (c) **royalty-free / CC0** with attribution recorded below.

## How this file is maintained

Every time an asset is added under `public/assets/`, a row is added to the
relevant table below recording its source, author, and license. Before any
public or commercial release, all rows must resolve to one of the three
categories above and the rulebook PDF must be excluded from distribution.

## Board art (`public/assets/board/`)

| File                                                                         | Description   | Source   | Author   | License          |
| ---------------------------------------------------------------------------- | ------------- | -------- | -------- | ---------------- |
| _(original SVG board generated from `src/core/data/board.ts` — see Phase 3)_ | Day/Night map | Original | MYSpolly | Project-original |

## Tile art (`public/assets/tiles/`)

| File                                       | Description           | Source   | Author   | License          |
| ------------------------------------------ | --------------------- | -------- | -------- | ---------------- |
| _(original procedurally styled SVG tiles)_ | Industry & link tiles | Original | MYSpolly | Project-original |

## Card art (`public/assets/cards/`)

| File                              | Description                      | Source   | Author   | License          |
| --------------------------------- | -------------------------------- | -------- | -------- | ---------------- |
| _(original SVG card faces/backs)_ | Location / industry / wild cards | Original | MYSpolly | Project-original |

## Icons (`public/assets/icons/`)

| File                                                                                                      | Description                              | Source   | Author   | License          |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------- | -------- | ---------------- |
| _(original SVG icons: coal, iron, juice, VP, income, money)_                                              | Resource icons                           | Original | MYSpolly | Project-original |
| _(original juice-works tile/icon + juice-barrel cube, theme replacement for the former brewery/beer art)_ | Juice Works industry icon + juice barrel | Original | MYSpolly | Project-original |

## Audio (`public/assets/audio/`)

The audio engine (`src/app/audio/sound.ts`) references these clip paths. Each is
to be supplied as an **original or CC0** asset; until present, the engine fails
soft (the game runs silently). SFX: `sfx/{tile-place,link-place,cube,coin,card-draw,card-discard,flip,button,error,era-fanfare,victory}.mp3`. Music: `music/{menu,canal,rail}.mp3`.

| File          | Description             | Source | Author | License        |
| ------------- | ----------------------- | ------ | ------ | -------------- |
| `sfx/*.mp3`   | UI & game sound effects | TBD    | TBD    | CC0 / original |
| `music/*.mp3` | Menu + per-era ambience | TBD    | TBD    | CC0 / original |

## Fonts (`public/assets/fonts/`)

| File                                                     | Description    | Source | Author | License           |
| -------------------------------------------------------- | -------------- | ------ | ------ | ----------------- |
| _(open-license display & body fonts only, e.g. SIL OFL)_ | Display / body | TBD    | TBD    | SIL OFL / similar |

---

_Last reviewed: project bootstrap. The bundled `Brass-Birmingham-Rulebook.pdf`
is a reference for engineering only and must **not** be redistributed._


## Maps & Era-Morphing Boards (Phase 8 / §7.15)

All 10 maps use **original, fictional geographies and invented place names** created
for this project — no publisher board, artwork, or map data is reproduced. This keeps
the multi-map system fully original/royalty-free.

- **Full maps (5):** Birmingham (classic West-Midlands layout, original art),
  Severn Vale, Highland Reach, Iron Coast, and **Skyward Dominion** (a three-era map
  that adds an **Air Era** after the Rail Era).
- **Fast-play maps (5):** Quill Hollow, Tin Brook, Maple Cross, Slate Pike, Amber Fen —
  small, short-deck layouts tuned to play quickly and run smoothly on modest hardware.
- **Per-era route styling** is generated procedurally from each era's `routeType`:
  - Canal Era — blue dotted "water" routes; transport vehicle: cargo boat/barge.
  - Rail Era — solid railway lines with tie overlays; transport vehicle: freight train.
  - Air Era — purple dashed flight arcs; transport vehicle: cargo plane.
- **Thumbnails / skins** are referenced by id under `public/assets/board/thumbnails/`
  and selected by the in-app map picker; the picker degrades to emoji glyphs when a
  thumbnail asset is not present. Any bitmap/vector art added later must be
  original or CC0 and recorded here.
- **Map & location names** are localized i18n keys (EN/RU/UZ); Russian names are
  transliterated to Cyrillic and Uzbek uses the Latin form (consistent with how
  invented place names are rendered across scripts).


## Goods-Delivery Transport SFX (Phase 8G / §7.4.1)

The Sell goods-delivery animation plays a per-vehicle sound effect, referenced under
`public/assets/audio/sfx/` and to be supplied as original or CC0 clips (recorded here):

- `boat-horn.mp3` — Canal Era cargo boat/barge.
- `train-whistle.mp3` — Rail Era freight train.
- `plane-flyby.mp3` — Air Era cargo plane.

Vehicle visuals use emoji glyphs (🛶 boat / 🚂 train / ✈️ plane) and a 📦 cargo token,
drawn as original SVG markup; no third-party artwork is used. All clips fail soft (the
game runs silently if an asset is absent).
