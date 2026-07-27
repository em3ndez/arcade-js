# The Pit — mechanism map (code-grounded understanding)

A working model of how the game actually plays, built **from the translated Z80 routines +
observed MAME attract mode**, not from external descriptions (this game has no public
reverse-engineering — that's the point). Every claim is tagged:

- **[seen]** — observed directly in a captured MAME frame.
- **[code]** — derived from a translated routine's behaviour (exact) — role is inference, mechanics are faithful.
- **[guess]** — plausible but unverified; do not rely on it.

This is the precursor to the naming + idiomatic passes: as roles get confirmed, they become
`ram.js` names and English routine names. **Much of that has now happened** — 125/169 routines are
decompiled to idiomatic JS, ~89 carry earned English names (proposer≠confirmer + adversarial-judge),
and `ram.js` holds ~90 named work-RAM addresses. This map is updated to reflect that understanding;
routine names below are the earned idiomatic names where they exist, neutral `loc_<addr>` otherwise.

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

Names in **bold-code** are earned idiomatic names (confirmed); `loc_<addr>` is a correct-but-not-yet-named routine.

| Mechanism | Routine(s) | Evidence |
|---|---|---|
| **Cold boot / init** | `loc_01a4` (di/im1, stack, RAM seed, busy-delay → 0x03ac) | [code] |
| **Per-frame service (vblank NMI)** | `loc_0066` (input sample + debounce, coin, service, re-arm) | [code] |
| **Player dig / wall collision** | `steerDemoPlayer`-adjacent `loc_03e8` → maze-wall move-dir at `DEMO_STEER_DIR` 0x801b | [code] the tunnel-movement core |
| **Attract-demo "AI" (fake joystick)** | `steerDemoPlayer` (0x03e8) writes a move dir the dispatcher reads *in place of* the stick | [code] the standout decompile |
| **Per-frame object step from control** | `stepObjectFromControl` (0x1420): picks `DEMO_STEER_DIR` (demo) vs debounced joystick by `GAME_MODE`, hands to the update dispatcher `loc_1434` | [code] |
| **Object action dispatch** (per-state) | `loc_13de`, `loc_1434`, `loc_144c` (first-set-bit command dispatcher), `stepHighScoreInitialsEntry` (0x4eea) | [code] state machines keyed on a mode byte |
| **Tile-under-object classify** (dirt / diamond / empty) | `loc_1568` / `loc_1515` / `loc_14cd` (shared body); probe walk via `PROBE_CELL_PTR`/`SUBTILE_PHASE`, tables in `loc_3476`-family region | [code] drives collect vs dig |
| **Object move + terrain-resolve** (both axes) | `loc_1a02` (vertical/climb) and `loc_1704` (horizontal): step the tracked object one frame, then resolve the tile it enters — collect loot, carve, hold against a wall, bump-react, or walk on | [code] the paired move handlers; axis labels inferred |
| **Loot collect + score + blank tile** | `collectLootTile` (0x18cf): `awardTenPoints`/`awardTwentyPoints`, bump per-kind counter, blank the cell, keep moving | [code] **the core scoring loop** |
| **Dig reaction + dig-entity spawn** | `triggerDigReaction` (0x191f): on a diggable tile stages `REACTION_STATE`=3 + dig sprite + dig sound; `loc_28ab` stages a dig entity at the aligned cell and commits it into the map | [code] |
| **Player walk-frame animation + step** | `walkActor` (0x184a step-by-velocity + walk-sprite cycle), `advanceActorWalk` (0x19d0), `drawActorWalkFrame` (0x19e3), `advanceObjectWalkFrame` (0x1659); `loc_186a`→`loc_186f` (cell geometry + tile dispatch) | [code] |
| **Object / enemy movers** | `0x3490` velocity-preset family (`loc_3476/347d/3484/348b`, direction presets), `advanceDormantMover` (0x34da), `descendActorToRest` (0x3968 ease a two-body actor to its floor), `advanceAltPhaseActor` (0x384a) | [code] axis/direction semantics still partly unpinned |
| **Actor spawn (primary + twin records)** | `seedObjectRecords` (0x30de), `loc_37cf`/`loc_38c8`/`loc_3984` seed `OBJ1_*`/`OBJ2_*` + `ACTOR_*` 0x810a.. / `TWIN_*` 0x811b.. + `stageObjectSpriteRecord` (0x1b5b) | [code] two-body actor (sprite + shadow) |
| **Background scroll sprite** (the sky UFO?) | `BG_SPRITE_*` (0x80db.. X/frame/attr/Y) bounced by `loc_2f71`, frame set by `setBgSpriteFrame` (0x2fd9) | [guess] the patrolling top-band object |
| **Column / vertical tile reveal animation** | `reseedColumnAnimation` (0x23e8) + `loc_241c` walk; `REVEAL_*` (0x80e4/5/6); the `loc_2f71`/`2f88`/`drawTerrainColumn` (0x2fb7)/`2fc0` blitters | [code] the dirt/shaft animation |
| **Board-display setup** (screen rebuild per board mode) | `setupBoardDisplay(m, boardMode)` (0x4b46): clear sprites, wipe tilemap, flood colour RAM, blank staging; doors `loc_4b40`(0x90)/`loc_4b44`(0x00)/`loc_4b3c`(0xC0) | [code] |
| **Static attract screens** | `showCreditScreen` (0x021c), `showSetupScreen` (0x3a6f), `showFixedScreen` (0x3b81) — paint a canned screen and hold | [code] |
| **HUD panels & labels** | `drawSharedPanel` (0x3cc1 skeleton), `drawMenLeftPanel` (0x483a "MEN LEFT"/"LAST MAN" + count `0x802b`), `drawCreditsDisplay` (0x4894 "CREDITS"+count), `drawPlayerLabel` (0x47e1 "PLAYERS"), `drawGameOverText`/`drawGameOverLabel` | [code] ROM glyphs decoded + confirmed |
| **Score readouts** | `renderScoreReadouts` (0x4cca), `initScoreDisplay` (0x4bc7), `drawScoreDigits` (0x46af), `unpackScoreDigits` (0x4d0c BCD→digits), `addScore`/`awardOnePoint`/`awardTenPoints` | [code] |
| **High-score table + entry** | `submitPlayerHighScore` (0x4cbf, end-of-round: load finishing score → insert → repaint), `loc_4d3a` (top-3 insert), `stepHighScoreInitialsEntry` (0x4eea), `advanceInitialUp` (0x4f38 step an initial letter) | [code] backs "BEST SCORES TODAY" |
| **Edge / terrain column paint** | `drawLeftEdgeColumn` (0x46f4 col 0), `drawRightEdgeColumn` (0x47a1 col 31), `drawTerrainColumn` (0x2fb7), `cycleColumnColour` (0x3e13 palette-cycle a column), `glitterDiamonds` (0x06ac diamond colour flash) | [code] |
| **Sound request** | `requestSoundN` stubs → shared enqueue `enqueueSoundCommand` (0x4ca5) → ring at `SOUND_RING`/`SOUND_HEAD` (0x8020/0x801e) | [code] |
| **DSW → gameplay params** | `loc_4b55` decodes dip bits into 0x804c–0x8053 (incl. lives → `0x802b` men-left, `STEP_TIMER_BASE` 0x804f) | [code] |
| **Player-record swap** | `loadPlayerState` (0x4644) / `saveActivePlayerRecord` (0x4632) copy the active player's block to/from the shared live slot | [code] 2-player alternation |
| **PRNG** | `advanceRandom` (0x4b1a) — 16-bit LFSR, reseeds if zero; drives enemy/column jitter | [code] |
| **Tile-cell address calc** (row,col → tilemap + cursors) | `rowColToTileOffset` (0x3dae → `TILEMAP_OFFSET`), `deriveTileWriteCursors` (0x3dc9 → `COLOUR_RAM_CURSOR`); fills via `copyTileColumn`/`copyCappedTileColumn`/`fillColourColumn` | [code] |
| **Render** (state → pixels) | `boards/thepit/video.js` — 5-layer compose, per-column Y-scroll, +16 vtop | [seen] pixel-exact vs MAME |

## RAM roles

The named work-RAM constants live in **`idiomatic/ram.js`** (~90 names). The newest ~43 got the full
proposer≠confirmer + adversarial-judge treatment (cross-routine consensus, keep-hex-if-ungrounded);
older ones are tagged strong/fair/weak. Highlights:
- **Probe / tile:** `OBJ_X`/`OBJ_Y` (0x8068/0x806b), `SPRITE_CODE` (0x8069), `DEMO_STEER_DIR` (0x801b
  the demo move-dir), `OBJ_TILE_COL`/`OBJ_TILE_ROW` (0x8071/0x8073), `PROBE_CELL_PTR` (0x8089),
  `SUBTILE_PHASE` (0x808d), `OBJ_SPRITE_ATTR` (0x806a), `MOVER_STATE` (0x8090).
- **Score / HUD:** `SCORE_LO`/`SCORE_HI` (0x8031/0x8034), `SCORE_DISPLAY_LOW`/`HIGH` (0x8037/0x8038),
  the men-left counter **0x802b**, `SOUND_HEAD`/`SOUND_RING` (0x801e/0x8020).
- **Actor records:** `ACTOR_*`/`TWIN_*` (0x810a../0x811b..), `ACTOR_STEP_X`/`Y` (0x810e/0x810f),
  `TWIN_TIMER` (0x8123), `OBJ1_X`/`OBJ2_X`… (0x80e8../0x80f9.. two object records), `SPAWN_PHASE`
  (0x807b), `ACTOR_TIMER` (0x8112).
- **Sub-objects:** `DIG_OBJ_ATTR`/`TIMER`/`SUBTYPE`/`ARM_STATE` (0x80ab..0x80c1), `REACTION_OBJ_X`/`Y`
  (0x8094/0x8097), `BG_SPRITE_X`/`FRAME`/`ATTR`/`Y` (0x80db..0x80de, the sky object).
- **Animation / geometry:** `TILEMAP_OFFSET` (0x805a), `COLOUR_RAM_CURSOR` (0x805e), `COLUMN_ANIM_TIMER`/
  `WRITE_PTR` (0x8067/0x8065), `REVEAL_PERIOD`/`GATE`/`CURSOR` (0x80e4/5/6), `ANIM_PHASE_COUNTER`
  (0x80e3), `GLITTER_COUNTDOWN` (0x805c), `FRAME_WAIT_COUNTDOWN` (0x8009), `STEP_TIMER_BASE` (0x804f),
  `GAME_MODE` (0x8001), `BOARD_MODE` (0x8057), DSW params 0x804c–0x8053.

Deliberately still hex (held by the judge as ungrounded — mixed/unpinned roles): the object-record axis
bytes at 0x80e0/0x80e1/0x80eb/0x8086/0x80a1 (the object-1 Y and several velocity/step fields), 0x8075
(object flags / dispatcher key), 0x80c3 (24-entry object table, scanned by `loc_2bf2`).

## Resolved this pass  [code]

- **How a collected diamond scores + removes its tile** — `collectLootTile` (0x18cf): on a scoring
  tile it awards points (`awardTenPoints` / the 20-pt `awardTwentyPoints`), bumps that loot kind's
  counter, **blanks the cell** (tile 112), and keeps the actor moving. The core scoring loop.
- **The score display path** — `renderScoreReadouts`/`initScoreDisplay`/`drawScoreDigits` →
  `unpackScoreDigits` (BCD→digit tiles), from the `SCORE_LO`/`HI` block.
- **The HUD** — a lives panel `drawMenLeftPanel` ("MEN LEFT"/"LAST MAN" + count 0x802b, seeded from the
  DSW lives dip), a "CREDITS n" display, a "PLAYERS" label, and a shared panel skeleton — all glyph-decoded.
- **2-player alternation** — `loadPlayerState`/`saveActivePlayerRecord` swap the active player's record.

## Open questions (to resolve as translation completes)

- Exact **win/lose conditions** and the timer (a tick counter gates flags — `loc_3458`/`advanceDormantMover`).
- What the **UFO / background scroll sprite** does — `BG_SPRITE_*` is bounced left↔right by `loc_2f71`
  and its frame animated by `setBgSpriteFrame`; whether it fires/bombs is still unpinned. [guess]
- The bottom **creatures'** behaviour and the "ZUN…" label (full enemy name unread).
- The **object-mover axis semantics** — the `loc_3476`-family direction presets and several object-record
  step/velocity bytes stayed `loc_`/hex because X-vs-Y is contested under ROT90; needs a control-poke pass.
- The **elevator/shaft** the player starts in (top-left green structure) — lift or just the entry?

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
