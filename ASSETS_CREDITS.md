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

| File | Description | Source | Author | License |
| ---- | ----------- | ------ | ------ | ------- |
| _(original SVG board generated from `src/core/data/board.ts` — see Phase 3)_ | Day/Night map | Original | MYSpolly | Project-original |

## Tile art (`public/assets/tiles/`)

| File | Description | Source | Author | License |
| ---- | ----------- | ------ | ------ | ------- |
| _(original procedurally styled SVG tiles)_ | Industry & link tiles | Original | MYSpolly | Project-original |

## Card art (`public/assets/cards/`)

| File | Description | Source | Author | License |
| ---- | ----------- | ------ | ------ | ------- |
| _(original SVG card faces/backs)_ | Location / industry / wild cards | Original | MYSpolly | Project-original |

## Icons (`public/assets/icons/`)

| File | Description | Source | Author | License |
| ---- | ----------- | ------ | ------ | ------- |
| _(original SVG icons: coal, iron, beer, VP, income, money)_ | Resource icons | Original | MYSpolly | Project-original |

## Audio (`public/assets/audio/`)

The audio engine (`src/app/audio/sound.ts`) references these clip paths. Each is
to be supplied as an **original or CC0** asset; until present, the engine fails
soft (the game runs silently). SFX: `sfx/{tile-place,link-place,cube,coin,card-draw,card-discard,flip,button,error,era-fanfare,victory}.mp3`. Music: `music/{menu,canal,rail}.mp3`.

| File | Description | Source | Author | License |
| ---- | ----------- | ------ | ------ | ------- |
| `sfx/*.mp3` | UI & game sound effects | TBD | TBD | CC0 / original |
| `music/*.mp3` | Menu + per-era ambience | TBD | TBD | CC0 / original |

## Fonts (`public/assets/fonts/`)

| File | Description | Source | Author | License |
| ---- | ----------- | ------ | ------ | ------- |
| _(open-license display & body fonts only, e.g. SIL OFL)_ | Display / body | TBD | TBD | SIL OFL / similar |

---

_Last reviewed: project bootstrap. The bundled `Brass-Birmingham-Rulebook.pdf`
is a reference for engineering only and must **not** be redistributed._
