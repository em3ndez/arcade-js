# The Pit — mechanism map (code-grounded understanding)

A working model of how the game actually plays, built **from the translated Z80 routines +
observed MAME attract mode**, not from external descriptions (this game has no public
reverse-engineering — that's the point). Every claim is tagged:

- **[seen]** — observed directly in a captured MAME frame.
- **[code]** — derived from a translated routine's behaviour (exact) — role is inference, mechanics are faithful.
- **[guess]** — plausible but unverified; do not rely on it.

This is the precursor to the naming + idiomatic passes: as roles get confirmed, they become
`ram.js` names and English routine names.

## ★ Validation status  [seen]

**The engine boots from reset, runs the whole attract loop, and renders it pixel-exact vs MAME.**
`emit.js` runs 300+ frames with no gap; its per-frame video/sprite RAM is byte-identical to the
MAME golden, and `render.js` → the pixel diff is **302/304 frames pixel-exact** (2 misses = 0.11%
sub-frame jitter). So the whole boot→attract path — every routine below that runs before gameplay —
is validated *integrally*, not just per-routine. Gameplay (with input) is the remaining unvalidated
region.

## Boot & the frame loop  [code]

- Reset `loc_0000` → `jp loc_01a4` (cold-boot init: `di`/`im1`, `ld sp,0x83ff`, seed work RAM, a
  ~65536-iter busy-delay) → `loc_03ac` (reset epilogue: clears mode, arms state, DSW decode) →
  `loc_01f9`/`loc_031a` round setup → **`loc_0348`, the in-game main loop** (`jr 0x0348` self-loop:
  watchdog kick `ld a,(0xb800)`, a gated `call loc_03e8`, and a frame-pacing delay).
- **`loc_0066` is the vblank NMI** (fires each frame, armed by the LS259 latch bit 0): samples input,
  handles coin, runs the per-frame service, re-arms the NMI (`ld (0xb000),a`) and `ret`s. In our
  machine the frame boundary throws to unwind the stack and fire the NMI from a clean stack.

## What the game is  [seen]

A **dig-into-the-pit / collect-the-loot** game. The playfield is a vertical cross-section:

- **Top band** — sky, with a **UFO / mothership** patrolling left↔right.  [seen]
- **Top-left** — a green **surface shaft/building** holding the small **player figure**.  [seen]
- **Middle & bottom** — a large **dirt cavern/maze** of brown blocks studded with **red diamonds** (the loot).  [seen]
- **Bottom** — a pink band with a **row of white creatures** (enemies; the demo flashes a "ZUN…" label).  [seen]

The player tunnels down through the dirt, collects diamonds, and contends with the sky UFO and
the bottom creatures.

## Attract cycle  [seen]

Loops **title/high-score screen ↔ gameplay demo**. The title carries "SCORE1 CENTURI SCORE2",
"GAME OVER", the 1P/2P credit menu, "© 1982 CENTURI INC", and a **"BEST SCORES TODAY"** table
(high-score display is folded into the title). The title has a **deterministic blink** (frames
alternate on a fixed period — no RNG), which matters for pixel-matching by frame phase.

## Mechanisms → routines

| Mechanism | Routine(s) | Evidence |
|---|---|---|
| **Cold boot / init** | `loc_01a4` (di/im1, stack, RAM seed, busy-delay → 0x03ac) | [code] |
| **Per-frame service (vblank NMI)** | `loc_0066` (the NMI handler; input sample, coin, re-arm) | [code] |
| **Player dig / wall collision** | `loc_03e8` → 4-way blocked-direction bitmask at **0x801b** | [code] the tunnel-movement core |
| **Tile-under-object classify** (dirt / diamond / empty) | `loc_1568` / `loc_1515` / `loc_14cd` (shared body) | [code] drives collect vs dig |
| **Object/enemy movement** | `0x3490` velocity-preset family (`loc_3476/347d/3484/348b`), `loc_3748`, `loc_384a`, `loc_3968` | [code] |
| **Player walk-frame animation** | `loc_184a`, `loc_186a`→`loc_186f` | [code] |
| **Actor spawn + draw** (tile+colour stamp into VRAM/CRAM) | `loc_37cf`, `loc_38c8` | [code] |
| **Object action dispatch** (per-state) | `loc_13de`, `loc_1434`, `loc_144c`, `loc_4eea` | [code] state machines keyed on a mode byte |
| **Sound request** | `loc_4c1f..4ca3` stubs → shared enqueue `loc_4ca5` → ring at `SOUND_RING` 0x8020 | [code] |
| **High-score table + score display** | `loc_4d3a` (top-3 insert), `loc_4d0c` (BCD digit unpack) | [code] backs "BEST SCORES TODAY" |
| **DSW → gameplay params** | `loc_4b55` decodes dip bits into 0x804c–0x8053 | [code] |
| **Actor spawn (primary + twin records)** | `loc_37cf`/`loc_38c8`/`loc_3984` seed `ACTOR_*` 0x810a.. + `TWIN_*` 0x811b.. + colour/tile stamp | [code] a two-body actor (sprite + shadow) |
| **Column / vertical tile animation** | `loc_2f71`/`loc_2f88`/`loc_2fb7`/`loc_2fc0` (frame-gated 6-tile column blit) | [code] the dirt/shaft animation |
| **Tile-cell address calc** (row,col → tilemap offset) | `loc_3dae`-style (`TILE_ROW`/`TILE_COL` → HL) | [code] |
| **Render** (state → pixels) | `boards/thepit/video.js` — 5-layer compose, per-column Y-scroll, +16 vtop | [seen] pixel-exact vs MAME |

## RAM roles

The named work-RAM constants now live in **`idiomatic/ram.js`** (~27 names, each proposed from
cross-routine corroboration and tagged strong/fair/weak; a proposer≠confirmer verification pass is
still owed). Highlights: `OBJ_X`/`OBJ_Y` (0x8068/0x806b probe coords), `SPRITE_CODE` (0x8069),
`DIG_DIRS` (0x801b — the maze-wall bitmask), `GAME_MODE` (0x8001), `BOARD_MODE` (0x8057),
`ACTOR_*`/`TWIN_*` (0x810a../0x811b.. actor records), `SPAWN_PHASE` (0x807b), `ACTOR_TIMER` (0x8112),
`SOUND_HEAD`/`SOUND_RING` (0x801e/0x8020), the DSW params 0x804c–0x8053, and the score/high-score
block (0x8031/0x8034, 0x803c/41/46, 0x8037/38). Not yet named (still hex): 0x8075 (object flags /
dispatcher key), 0x8018 (object-action selector), 0x80c3 (24-entry object table, scanned by
`loc_2bf2`), 0x80e7 (tile-under-object record).

## Open questions (to resolve as translation completes)

- Exact win/lose conditions and the timer (a tick counter gates flags — `loc_3458`/`loc_34da`).
- What the **UFO** does — patrol only, or does it fire/bomb? (a sky-object dispatcher, not yet pinned).
- The bottom **creatures'** behaviour and the "ZUN…" label (full enemy name unread).
- How a collected diamond scores + removes its tile (the classifier writes 0x80e7; the scoring link is unconfirmed).
- The elevator/shaft the player starts in (top-left green structure) — is it a lift, or just the entry?

## Pixel-testing status

1. **Title / attract — ✅ PASSING**: `machine.js` + `render.js` render our live state through
   `video.js` and the pixel diff vs the certified MAME golden is **302/304 frames pixel-exact** (2
   transient sub-frame-jitter frames within the reconverge gate). The one render bug was `video.js`
   missing the +16 visible-area vtop (`roundup.cpp` `set_raw` vbend=16).
2. **Live gameplay — TODO**: needs an input tape (drive coin/start/move/dig). Will exercise sprites
   for the first time — the sprite Y likely needs the matching −16 (`224 - spriteram`), flagged
   UNVERIFIED in `video.js` (no on-screen sprites in the attract capture). Also needs the entropy pin
   (enemy motion uses the RNG).

Golden: `out/golden/pixel/` (certified MAME reset run, frames.rgb + state.bin), plus staged attract
reference frames `out/golden/attract/{title_ref,demo_ref}.png` (gitignored, ROM-derived).
