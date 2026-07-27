# The Pit — mechanism map (code-grounded understanding)

A working model of how the game actually plays, built **from the translated Z80 routines +
observed MAME attract mode**, not from external descriptions (this game has no public
reverse-engineering — that is the point). Every claim is tagged:

- **[seen]** — observed directly in a captured MAME frame.
- **[code]** — derived from a translated routine's behaviour. The *mechanics* are exact (the lift
  is faithful); the *role* is inference from them.
- **[guess]** — plausible but unverified; do not rely on it.

This map is the precursor to (and companion of) the naming + idiomatic passes: as a role reaches
confidence it becomes a `ram.js` name and an English routine name. **Most of that has now
happened.** As of this pass:

- **159 / 169** ROM routines are decompiled to idiomatic JS; **122** of those carry earned
  English names, **37** stay neutral `loc_<addr>` (role clear, but a single verb would over- or
  under-claim). **10** routines are still the frozen oracle (registered, memory-faithful, not yet
  rewritten).
- `idiomatic/ram.js` holds **107** named work-RAM addresses (proposer≠confirmer + adversarial
  judge on the newest ~60; older ones tagged strong/fair/weak).

Routine names below are the earned idiomatic names where they exist, neutral `loc_<addr>`
otherwise; every name cited is a routine that exists in the tree.

## ★ Validation status  [seen]

**The engine boots from reset, runs the whole attract loop, and renders it pixel-exact vs MAME.**
`emit.js` runs 300+ frames with no boot gap; its per-frame video/sprite RAM is byte-identical to
the MAME golden, and `render.js` → the pixel diff is **302 / 304 frames pixel-exact** (2 misses =
0.11 %, sub-frame blink jitter inside the reconverge window). So the whole boot→attract path —
every routine that runs before gameplay — is validated *integrally*, not just per-routine.

Two render facts are now pixel-confirmed against MAME goldens (both were the one-line `video.js`
bugs that broke the match, see `boards/thepit/video.js`):

- The tilemap samples row `sy + 16` — the `+16` visible-area vtop (`roundup.cpp` `set_raw`
  vbend = 16). Verified pixel-exact (0 / 57344 pixels off).
- Sprite Y takes the matching **−16**, and sprites are clipped to columns `[17, 255]` upright /
  `[0, 238]` flip-X (the left status band). Both were **verified against a gameplay input-tape
  golden** — enemy sprites in the bottom band matched MAME to the pixel once applied. So on-screen
  sprites (which the attract capture never shows) now have real evidence behind them, not just the
  attract path.

## What the game is  [seen]

A **dig-into-the-pit / collect-the-loot** game. The playfield is a vertical cross-section:

- **Top band** — sky, with a **UFO / mothership** patrolling.
- **Top-left** — a green **surface shaft / building** holding the small **player figure**.
- **Middle & bottom** — a large **dirt cavern / maze** of brown blocks studded with **red
  diamonds** (the loot).
- **Bottom** — a pink band with a **row of white creatures** (enemies; the demo flashes a "ZUN…"
  label whose full text is unread).

The player tunnels down through the dirt, collects diamonds, and contends with the sky object and
the bottom creatures.

## Attract cycle  [seen]

Loops **title / high-score screen ↔ gameplay demo**. The title carries "SCORE1 CENTURI SCORE2",
"GAME OVER", the 1P/2P credit menu, "© 1982 CENTURI INC", and a **"BEST SCORES TODAY"** table (the
high-score display is folded into the title). The title has a **deterministic blink** (frames
alternate on a fixed period — no RNG), which matters for pixel-matching by frame *phase*.

## Boot & the frame loop  [code]

The whole boot/reset/interrupt spine is **still the frozen oracle** — memory-faithful but not yet
decompiled — with a handful of decompiled helpers wired into it.

- **Reset** `loc_0000` *(oracle)* → **`coldBootInit`** (0x01a4) — cold-boot init (`di`/`im1`, `ld sp,0x83ff`,
  seed work RAM, a ~65536-iter busy delay). *(reset vector still oracle; `coldBootInit` decompiled)*
- → **`loc_03ac`** reset/round-restart epilogue (begin a fresh attract cycle: clear mode, arm state,
  decode the DSW via `applyDipSwitches`) → `loc_01f9` boot fork (on the restart flag at 0x8000 →
  `showCreditScreen`) / `loc_031a` round setup *(both oracle)*.
- → **`loc_0348`, the in-game main loop** (`jr 0x0348` self-loop): watchdog kick `ld a,(0xb800)`, a
  frame-pacing delay, and — while the game-mode byte is 4 (attract demo) — a call to the per-frame
  gameplay/demo service **`steerDemoPlayer` (0x03e8, decompiled)**. *(loop is oracle)*
- **`loc_0066` is the vblank NMI** (fires each frame): samples the two input ports and debounces
  them into `IN0_DEBOUNCED`/`IN1_DEBOUNCED`, handles coin/credit, decrements `FRAME_WAIT_COUNTDOWN`,
  `LDIR`s the 32-byte sprite staging buffer (`SPRITE_STAGING_BASE` 0x8220) into hardware sprite RAM
  0x9840, re-arms the NMI, and `ret`s. *(oracle)* In our machine the frame boundary throws to unwind
  the stack and fire the NMI from a clean stack.
- **Decompiled boot/frame helpers:** `showCreditScreen` (0x021c warm-restart entry: arm game-mode 3,
  reset the work stack, `enableNmi`, run `blankScreen`, tail into the fixed-screen painter 0x3ba8),
  `enableNmi` (0x4b14) / `disableFrameInterrupt` (0x4b10), `waitFrames` (0x4bff, busy-waits
  `FRAME_WAIT_COUNTDOWN` to 0), `applyDipSwitches` (0x4b55).

## Mechanisms → routines

Grouped by subsystem. **Bold** names are earned idiomatic names; `loc_<addr>` is a
correct-but-not-yet-named routine; *(oracle)* marks a routine that exists but is not yet
decompiled.

### Input & attract-demo AI  [code]

| Mechanism | Routine(s) |
|---|---|
| Attract-demo "AI" (fake joystick) | **`steerDemoPlayer`** (0x03e8): from the demo object's probe point, pick the one-of-four maze-wall direction and write it to `DEMO_STEER_DIR` where the joystick would go; also does the periodic HUD redraw + slow column colour-cycle. Its only caller is the main loop. |
| Control-source select | **`stepObjectFromControl`** (0x1420): if a reaction owns the object, defer; else pick `DEMO_STEER_DIR` (game-mode ≥ 3, the demo) vs `IN0_DEBOUNCED` (real play) and hand to `advanceObjectFrame`. |
| Input debounce | in the NMI `loc_0066` *(oracle)* → `IN0_DEBOUNCED`/`IN0_PREV`, `IN1_DEBOUNCED`/`IN1_PREV`. |

### Round & game lifecycle (start · turn-switch · game-over)  [code]

The top-level state machine that starts a game, alternates the two players' turns at each round
boundary, and tears down at game-over — all keyed on `GAME_MODE` / `GAME_STATE2` and the player record.

| Mechanism | Routine(s) |
|---|---|
| Start a game | **`startGame`** (0x022d: once a credit is registered, set up a fresh game) → **`enterPlayMode`** (0x03be: switch into active play and seed the per-round counters). |
| Round-boundary dispatch | **`loc_0278`** (0x0278: dock the active player's man count, persist their record, then route by the mode/player byte to next-round setup vs end-of-round teardown) → **`loc_02a1`** (0x02a1: step the round sub-phase `GAME_STATE2` 1↔2 and pick setup vs teardown). |
| Turn / round timeout | **`loc_3458`** (0x3458: tick a per-object state countdown and blink its sprite while it runs; on expiry it reaches the round boundary above). |
| Round-start setup | **`loc_02ca`** (0x02ca: make the selected player's saved progress current, decode the switches, rebuild the setup screen — the per-turn entry). |
| Game-over teardown | **`submitHighScoresAndReset`** (0x0371: offer each finishing player's final score to the high-score table, reset game state, hand to the reset entry). |
| Reset / restart epilogue | **`loc_03ac`** (0x03ac: begin a fresh attract cycle with no active player — both the boot reset epilogue and the mode ≥ 3 bail out of `loc_0278`). |

### Tracked-object per-frame step & dispatch  [code]

The player (and the tracked object generally) is driven by a chain of small dispatchers keyed on
state bytes; the axis (X vs Y under ROT90) is deliberately left un-named — see Open questions.

| Mechanism | Routine(s) |
|---|---|
| Object/state router (per frame) | **`advanceTrackedObject`** (0x13de): walks the object's control bytes (`OBJECT_ACTIVE`, `SPAWN_PHASE`, `DIG_OBJ_ARM_STATE`, motion marker 0x8075, `GOAL_TILE_LATCH`, `GOAL_CROSSING_LATCH`, `REVEAL_CURSOR`) and hands the frame to exactly one handler. |
| Mode/command pick | **`advanceObjectFrame`** (0x1434) → **`loc_144c`** (at-rest router on the move-command bits) → **`windUpObjectMove`** (0x1468, holds the move behind a wind-up counter packed into `OBJECT_PHASE`). |
| Vertical / climb step + resolve | **`stepObjectAndResolveTile`** (0x1a02): step one frame along the climb axis, locate the cell, collect loot / carve / block / walk. |
| Horizontal step + resolve | **`loc_16b9`** (0x16b9 router: goal-terminator vs terrain) → **`loc_1704`** (0x1704 terrain resolver: collect / hold / bump / walk). |
| Cell locate + tile dispatch | **`resolveObjectTile`** (0x186f): position → tile cell, read + publish the under-tile, route to the loot collector or the goal/walk continuation. **`loc_186a`** (0x186a) is a thin fixed-frame prologue into that tail. |
| Walk animation + step commit | **`walkActor`** (0x184a), **`advanceObjectWalkFrame`** (0x1659), **`advanceActorWalk`** (0x19d0), **`drawActorWalkFrame`** (0x19e3). |
| Object record builder | **`stageObjectSpriteRecord`** (0x1b5b): every settled/deferred path funnels here to build the 4-byte sprite record. |
| Tracked-object / level state seed | **`seedObjectStartState`** (0x1362). |

### Tile-under-object collision / classify  [code]

| Mechanism | Routine(s) |
|---|---|
| Terrain-response resolver (non-loot) | **`loc_1568`** (0x1568): latch the feature/goal tiles (38 / 39), classify solid / diagonal-gated / pushable (vs ROM tables at 0x1b78 / 0x1ce0), arm the push reaction. The vertical/other-axis counterpart of `loc_1704`. |
| Object-vs-tilemap collision body | **`loc_14cd`** (0x14cd, screen row from `loc_1493`) / **`loc_1515`** (0x1515: collect grid-aligned loot, else delegate every non-collect case to `loc_1568`), reached via **`loc_1493`** (0x1493, the mirror axis-arm of `loc_167f`; from `loc_144c`'s bit-0 arm) and the tile-row dispatch **`loc_167f`** (0x167f: continue the step or fire the dig one-shot; bit-1 arm → `loc_16b9`). |
| Probe-cell table search | **`tileInProbeRow`** (0x33bc: is the probe cell's tile in this phase's list?), **`loc_33da`** (0x33da), **`loc_3410`** (0x3410), **`loc_3425`** (0x3425) — phase-keyed ROM-table probes for the mover, using `PROBE_CELL_PTR` / `SUBTILE_PHASE` / `SAVED_CELL_PTR`. |

### Loot collect + score  [code]

| Mechanism | Routine(s) |
|---|---|
| Loot collect + blank tile | **`collectLootTile`** (0x18cf): on a cell boundary, tile 58 → +10, tiles 59..61 → +20 (gated by `FEATURE_TILE_LATCH` + the one-shot latch 0x8078), bump the per-kind count (`LOOT_10PT_COUNT` / `LOOT_20PT_COUNT`), blank the cell to tile 112, keep moving. The same collect logic is inlined in the vertical `stepObjectAndResolveTile` and horizontal `loc_1704`. |
| Score add | **`addScore`** (0x4689, packed-BCD, active-player-only) behind **`awardOnePoint`** (0x4673) / **`awardTenPoints`** (0x467b) / **`awardTwentyPoints`** (0x4683), each with its own sound. |

### Dig-object spawn / collision system  [code]

The maze's carve-and-place subsystem: the actor digs into terrain, a target/prize object is
spawned from a queue, descends to solid ground, and can capture the player.

| Mechanism | Routine(s) |
|---|---|
| Classify dig tile + arm reaction | **`triggerDigReaction`** (0x191f): sort the under-tile (always-hit codes, bit-2-gated codes, diggable band 113..153 vs ROM tables 0x1e48 / 0x1fb0), stage the reaction, request the reaction sound. |
| Stage + commit a dig entity | **`spawnDigEntity`** (0x28ab: classify → `{spriteId, subtype, yLift}`, stage into `STAGED_*`) → **`loc_2934`** (0x2934: promote the staged bytes, stamp the tilemap cell + patch neighbours). |
| Spawn from the pending queue | **`spawnPendingDigObject`** (0x2c04): raise `SPAWN_STATE`, play the sound, draw random slots from the **24-slot column queue at 0x80c3** (12 left columns paired to 12 right), paint the spawn tile (37), flag player-overlap into `CLIMB_GATE`. **`loc_2bf2`** (0x2bf2) starts the next queued spawn or clears the active flag. |
| Descending target + capture | **`captureTargetOnOverlap`** (0x2cb7: tick the countdown, on expiry test the capture box and snap the object onto the target), **`advanceDigTarget`** (0x2d06: step the target, embed it into solid ground), **`loc_2d4e`** (0x2d4e: land it), **`loc_2c91`** (0x2c91: player-overlap record). |
| Dig-object sprite record | **`stageDigObjectSpriteRecord`** (0x2bd3): compose slot 2 of the sprite buffer from `TARGET_X`/`DIG_OBJ_STATE`/`DIG_OBJ_ATTR`/`TARGET_Y`, biased by `SPRITE_COORD_BIAS`. |
| Round-start / reset seeds | **`loc_287a`** (0x287a: seed the dig/target control block), **`loc_24cf`** (0x24cf: reset the reaction state machine to idle), **`stampGlyphColumn`** (0x2d6b). |
| Per-frame drivers | **`advanceReactionObject`** (0x24f3): the `REACTION_STATE` per-frame driver — the four 8px direction phases, terrain scroll-walk, and edge-collision seed, then tails into the dig driver. **`loc_29ad`** (0x29ad): the dig-object commit/advance driver (branches on `DIG_OBJ_STATE`, decrements `SPAWN_STATE`, bbox-tests the target vs the player). |

### Object / enemy movers  [code]

| Mechanism | Routine(s) |
|---|---|
| Move driver | **`loc_319d`** (0x319d): probe the tiles around the mover, pick a direction, tail-jump into one of four presets. |
| Direction presets | **`loc_3476`** / **`loc_347d`** / **`loc_3484`** / **`loc_348b`** (0x3476.., stamp `MOVER_DIRECTION` 0/1/2/3, step the object, refresh facing on the cadence tick). |
| Mover housekeeping | **`advanceDormantMover`** (0x34da, two cadence counters incl. `MOVER_STATE`), **`loc_34f0`** (0x34f0, periodic refresh: reseed `ANIM_RAND`, re-arm `ACTOR_STATE`). |
| The two object records | `OBJ1_*` (0x80e8..) and `OBJ2_*` (0x80f9..), seeded by `seedObjectRecords`, difficulty-scaled by `LEVEL`. |

### Two-sprite actor spawn & descent  [code]

A **two-sprite actor**: a primary sprite plus a *twin* locked a rigid **+16** (one tile) alongside
it, so the two hardware sprites compose one ~32px-tall on-screen figure — **not a shadow, not the
player** (the player uses the tracked-object path).

| Mechanism | Routine(s) |
|---|---|
| Seed the actor pair | **`seedActorSpawnState`** (0x36fe): primary at `ACTOR_*` 0x810a.., twin at `TWIN_*` 0x811b.., cleared spawn phase. |
| One-shot spawners | **`spawnTwinActor`** (0x3984), **`spawnAltPhaseActor`** (0x37cf), **`loc_38c8`** (0x38c8, rebuild-at-edge sibling): stamp the 2×4 tile+colour figure, seed both records. |
| Per-frame animate + march | **`advanceAltPhaseActor`** (0x384a: cadence tick, walk-cycle flip, march right then descend), **`paceActorDescent`** (0x3945 cadence front end) → **`descendActorToRest`** (0x3968: ease the coord to a floor, twin trailing +16). |
| Build both sprite records | **`stageActorSpriteRecords`** (0x3a4c: copy `ACTOR_*`/`TWIN_*` into the buffer, Y biased by the DSW sprite offset). |

### Background scroll sprite (the sky object)  [guess]

| Mechanism | Routine(s) |
|---|---|
| Animated background sprite | `BG_SPRITE_X`/`FRAME`/`ATTR`/`Y` (0x80db..): a horizontal bounce oscillator + accelerating vertical fall, RNG-reseeded at the clamp. **`advanceBackgroundAnimation`** (0x2fc0 phase clock) + **`setBgSpriteFrame`** (0x2fd9 commit the flip tile); the per-frame monolith **`advanceBackgroundSprite`** (0x2f71) drives the bounce inline. **[guess]** that this is the patrolling top-band UFO. |

### Column / terrain reveal animation  [code]

| Mechanism | Routine(s) |
|---|---|
| Scrolling terrain reveal | **`reseedColumnAnimation`** (0x23e8) + **`advanceColumnAnimation`** (0x241c, frame-gated column step, using `COLUMN_ANIM_WRITE_PTR`/`COLUMN_ANIM_TIMER`), **`revealTerrainColumn`** (0x2f88, stamps 6-tile columns from ROM pattern table 0x3048 driven by `REVEAL_PERIOD`/`REVEAL_GATE`/`REVEAL_CURSOR`), **`drawTerrainColumn`** (0x2fb7). |

### Board-display setup  [code]

| Mechanism | Routine(s) |
|---|---|
| Rebuild the whole screen per board mode | **`setupBoardDisplay`** (0x4b46): clear sprites, wipe tilemap, flood colour RAM, blank staging. Multi-door entries stow `BOARD_MODE` first: **`blankScreen`** (0x4b44, mode 0x00), **`loc_4b40`** (0x4b40, 0x90), **`loc_4b3c`** (0x4b3c, 0xC0). |
| Bulk fills / clears | **`fillVideoRam`** (0x4c27), **`fillColorRam`** (0x4c37), **`clearSpriteAndAttributeRam`** (0x4c11), **`clearSpriteStagingBuffer`** (0x4c1c). |
| Full screen paint | **`paintScreen`** (0x0673: a selectable tile layer + its colour), **`glitterDiamonds`** (0x06ac: cycle the diamond cells' colour so they glitter). |

### Static attract / status screens  [code]

| Mechanism | Routine(s) |
|---|---|
| Canned held screens | **`showCreditScreen`** (0x021c), **`showSetupScreen`** (0x3a6f), **`showFixedScreen`** (0x3b81), **`showBonusScreen`** (0x3bec: a tier-selected status screen — count 5/10/15 from two config bytes — held with a sound + score + colour-cycle animation). |

### HUD panels & labels (glyph-decoded)  [code]

| Mechanism | Routine(s) |
|---|---|
| Panels & labels | **`drawSharedPanel`** (0x3cc1: edge column + both score HUDs), **`drawMenLeftPanel`** (0x483a "MEN LEFT" / "LAST MAN" + count 0x802b), **`drawCreditsDisplay`** (0x4894 "CREDITS"), **`drawPlayerLabel`** (0x47e1 "PLAYERS"), **`drawBestScoresTodayLabel`** (0x4785), **`drawCopyrightLine`** (0x492a "© 1982 CENTURI"), **`drawSetupCreditsPanel`** (0x3d49), **`drawGameOverLabel`** (0x48e5) / **`drawGameOverText`** (0x3d8a), **`redrawScoreHud`** (0x472c). |

### Score readouts + high-score table / entry  [code]

| Mechanism | Routine(s) |
|---|---|
| Score readouts | **`initScoreDisplay`** (0x4bc7), **`renderScoreReadouts`** (0x4cca), **`drawScoreDigits`** (0x46af), **`unpackScoreDigits`** (0x4d0c, BCD → digit tiles). |
| High-score table | **`submitPlayerHighScore`** (0x4cbf, end-of-round: load the finishing player's score → insert → repaint) → **`insertHighScore`** (0x4d3a, ranked insert into `HIGH_SCORE_TABLE` 0x8039). |
| Initials entry | **`runHighScoreInitialsEntry`** (0x4df8, the screen), **`stepHighScoreInitialsEntry`** (0x4eea, per-frame action dispatch: move the letter up a row on commit, cycle the letter), **`advanceInitialUp`** (0x4f38) / **`stepInitialDown`** (0x4f26). |

### Sound  [code]

| Mechanism | Routine(s) |
|---|---|
| Sound request | **`requestSound2`..`requestSound21`** stubs (0x4c57..0x4ca3) → **`enqueueSoundCommand`** (0x4ca5) → ring at `SOUND_RING`/`SOUND_HEAD` (0x8020/0x801e). **`enableSound`** (0x4c4d) / **`disableSound`** (0x4c47). |

### DSW → gameplay params  [code]

| Mechanism | Routine(s) |
|---|---|
| Decode dip switches | **`applyDipSwitches`** (0x4b55): fan the dip byte into 0x804c–0x8053 (bonus/lives pair, two counts, `STEP_TIMER_BASE`), the flip-screen / cocktail latch, and `SPRITE_COORD_BIAS` (0 upright). Top bit diverts to the colour-cycle test screen. |

### Player-record swap (2-player alternation)  [code]

| Mechanism | Routine(s) |
|---|---|
| Save / restore the active player | **`saveActivePlayerRecord`** (0x4632) / **`loadPlayerState`** (0x4644): five fields (level, two counters, two score bytes) stored as `[working, P1, P2]` triples from `LEVEL`; `GAME_STATE2` (0x8002) selects the column. |

### PRNG  [code]

| Mechanism | Routine(s) |
|---|---|
| Pseudo-random generator | **`advanceRandom`** (0x4b1a): 16-bit LFSR over `PRNG_LOW`/`PRNG_HIGH` (0x800d/0x800e), feedback = low bit1 XOR bit2; drives spawn-queue draws and enemy/column jitter. |

### Tile-cell geometry & column plotting  [code]

| Mechanism | Routine(s) |
|---|---|
| (row, col) → tilemap | **`rowColToTileOffset`** (0x3dae → `TILEMAP_OFFSET`), **`deriveTileWriteCursors`** (0x3dc9 → `COLOUR_RAM_CURSOR`). |
| Column copy / fill / cycle | **`copyTileColumn`** (0x3dea) / **`copyCappedTileColumn`** (0x3ddb), **`fillColourColumn`** (0x3e01) / **`fillColourColumnAt`** (0x3e1d), **`cycleColumnColour`** (0x3e13) / **`cyclePanelColumnColour`** (0x48c4) / **`cycleStagedColumnColour`** (0x3d7e) — all use `PLOT_RUN_LENGTH` (0x8055). |
| Fixed edge / picture columns | **`drawLeftEdgeColumn`** (0x46f4), **`drawRightEdgeColumn`** (0x47a1), **`loc_4816`** (0x4816). |
| Round/reset seeds | **`resetScoreAndSoundQueue`** (0x4bea), **`loc_2f2f`** (0x2f2f) → **`seedObjectRecords`** (0x30de) → `seedActorSpawnState` (the round/level parameter-seeding chain, difficulty-scaled off `LEVEL`). |

### Render (state → pixels)  [seen]

`boards/thepit/video.js` — native 256×224, **ROT90**. Five layers, later over earlier: (1) low-pri
solid background blocks, (2) foreground char tiles, (3) low-pri sprites, (4) high-pri solid blocks
(over sprites), (5) high-pri sprites. A cell is low- or high-priority by `(back_color != 0) && bit7
clear`. Each of the 32 columns scrolls vertically by `attributesram[col*2]`. Pixel-exact vs MAME
(see Validation status).

## RAM roles

The named work-RAM constants live in **`idiomatic/ram.js`** (107 names). Highlights by subsystem:

- **Object / probe / tile geometry:** `OBJ_X`/`OBJ_Y` (0x8068/0x806b), `OBJ_STEP_X`/`OBJ_STEP_Y`
  (0x806c/0x806d), `SPRITE_CODE` (0x8069), `OBJ_SPRITE_ATTR` (0x806a), `OBJ_TILE_COL`/`OBJ_TILE_ROW`
  (0x8071/0x8073), `ACTOR_CELL_PTR` (0x806e), `TILE_COL`/`TILE_ROW` (0x8058/0x8059),
  `PROBE_CELL_PTR` (0x8089), `SUBTILE_PHASE` (0x808d), `SAVED_CELL_PTR` (0x8134), `CUR_TILE`/
  `NEXT_TILE`/`EXPECTED_TILE` (0x80a5/0x80a8/0x80a7).
- **Tracked-object control block:** `OBJECT_ACTIVE` (0x8079), `STATE_TIMER` (0x807c), `SPAWN_PHASE`
  (0x807b), `OBJECT_PHASE` (0x801a), `DEMO_STEER_DIR` (0x801b), `CLIMB_GATE` (0x8080),
  `GOAL_TILE_LATCH` (0x80e7) / `GOAL_CROSSING_LATCH` (0x8077), `FEATURE_TILE_LATCH` (0x8076).
- **Reaction / dig object:** `REACTION_STATE` (0x80a2), `REACTION_TIMER` (0x80a4), `REACTION_OBJ_X`/
  `Y` (0x8094/0x8097), `TARGET_X`/`TARGET_Y` (0x80a9/0x80ac), `DIG_OBJ_STATE`/`ATTR`/`TIMER`/
  `SUBTYPE`/`ARM_STATE` (0x80aa/0x80ab/0x80b1/0x80c0/0x80c1), `SPAWN_STATE` (0x80bd), and the
  `STAGED_*` dig-spawn hand-off cells (`STAGED_TARGET_X`/`Y`, `STAGED_CELL_PTR`, `STAGED_DIG_TIMER`,
  `STAGED_DIG_SPRITE_ID` 0x80b6..0x80bf).
- **Movers / object records:** `MOVER_STATE` (0x8090), `MOVER_DIRECTION` (0x8092), `OBJ1_X`/
  `OBJ1_SPRITE_CODE`/`OBJ1_ATTR`/`OBJ1_MOVE_PERIOD`/`OBJ1_TARGET_COL` (0x80e8..0x80f8),
  `OBJ2_X`/`OBJ2_TILE`/`OBJ2_ATTR` (0x80f9..0x80fb), `ANIM_RAND` (0x808b), `ACTOR_STATE` (0x8084).
- **Two-sprite actor:** `ACTOR_X`/`TILE`/`Y`/`ATTR`/`STEP_X`/`STEP_Y`/`TIMER` (0x810a..0x8112),
  `TWIN_X`/`TILE`/`ATTR`/`CLEAR`/`TIMER` (0x811b..0x8123).
- **Background sprite / reveal:** `BG_SPRITE_X`/`FRAME`/`ATTR`/`Y` (0x80db..0x80de),
  `ANIM_PHASE_COUNTER` (0x80e3), `REVEAL_PERIOD`/`GATE`/`CURSOR` (0x80e4/5/6),
  `COLUMN_ANIM_WRITE_PTR`/`TIMER` (0x8065/0x8067).
- **Score / HUD / high-score:** `SCORE_LO`/`SCORE_HI` (0x8031/0x8034), `SCORE_DISPLAY_LOW`/`HIGH`
  (0x8037/0x8038), `HIGH_SCORE_TABLE` (0x8039), `LOOT_10PT_COUNT`/`LOOT_20PT_COUNT` (0x8081/0x8082),
  the men-left counter 0x802b.
- **Sprite staging / sound / timers:** `SPRITE_STAGING_BASE` (0x8220), `ACTOR_ATTR`/`TWIN_ATTR`
  (0x810c/0x811d), `SOUND_HEAD`/`SOUND_RING` (0x801e/0x8020), `FRAME_WAIT_COUNTDOWN` (0x8009),
  `FRAME_COUNTER` (0x8010), `GLITTER_COUNTDOWN` (0x805c), `LOOP_COUNTER` (0x800a).
- **Mode / level / DSW:** `GAME_MODE` (0x8001), `GAME_STATE2` (0x8002), `BOARD_MODE` (0x8057),
  `VARIANT` (0x8048), `LEVEL` (0x8028), `STEP_TIMER_BASE` (0x804f), `SPRITE_COORD_BIAS` (0x8051),
  DSW params 0x804c–0x8053.
- **Input / geometry:** `IN0_DEBOUNCED`/`IN0_PREV` (0x8018/0x8019), `IN1_DEBOUNCED`/`IN1_PREV`
  (0x8015/0x8016), `PRNG_LOW`/`PRNG_HIGH` (0x800d/0x800e), `TILEMAP_OFFSET` (0x805a),
  `COLOUR_RAM_CURSOR` (0x805e), `PLOT_RUN_LENGTH` (0x8055).

**Deliberately still hex** (held ungrounded — mixed/unpinned roles): the object motion marker 0x8075
and busy flag 0x807a; the object-record axis/velocity bytes (0x80e0/0x80eb/0x8086/0x80a1); the
reaction period 0x80a3 and raw-ahead scratch 0x80a6; the 24-slot dig queue base 0x80c3 and its
reload byte 0x80c2.

## Resolved (this understanding)  [code]

- **How loot scores + is removed** — `collectLootTile` (and the inlined copies in
  `stepObjectAndResolveTile` / `loc_1704`): on a cell boundary, tile 58 awards 10, tiles 59..61
  award 20 (gated by `FEATURE_TILE_LATCH` + a one-shot latch), each bumps its per-kind counter
  (`LOOT_10PT_COUNT` / `LOOT_20PT_COUNT`) and **blanks the cell** to tile 112. `showBonusScreen`
  reads those counters as completion thresholds.
- **The score / HUD system** — packed-BCD add (`addScore`), digit unpack (`unpackScoreDigits`),
  readouts (`renderScoreReadouts` / `drawScoreDigits`), a glyph-decoded HUD (MEN LEFT / CREDITS /
  PLAYERS / © CENTURI / BEST SCORES TODAY), and the high-score table + initials entry.
- **The dig-object spawn / collision system** — a 24-column queue (0x80c3) feeds `spawnPendingDigObject`,
  which paints a spawn tile and flags player-overlap; `spawnDigEntity` → `loc_2934` carve entities
  into the tilemap; the target descends (`advanceDigTarget`) and can capture the player
  (`captureTargetOnOverlap`); `triggerDigReaction` classifies the dug tile and arms the reaction.
- **The two-sprite actor** — a primary + a twin locked +16 compose one tall figure
  (`seedActorSpawnState` / `descendActorToRest` / `stageActorSpriteRecords`), distinct from the player.
- **2-player alternation** — `saveActivePlayerRecord` / `loadPlayerState` swap the active player's
  five-field record (selected by `GAME_STATE2`).
- **DSW → params** — `applyDipSwitches` decodes bonus/lives, difficulty timers, flip-screen/cocktail,
  and the sprite coordinate bias.

## Open questions

- **Object-mover axis semantics.** X vs Y is contested under ROT90, which is exactly why
  `stepObjectAndResolveTile` / `loc_1704` / `loc_1568` / the `loc_3476` presets keep neutral names.
  Needs a control-poke pass to pin the axis and promote them.
- **The per-frame driver cluster is now decompiled** (it was the last big oracle block): the move
  driver `loc_319d`, the dig-object commit driver `loc_29ad`, the reaction-state driver
  **`advanceReactionObject`** (0x24f3 — no code evidence of an "elevator"; named by role), the
  backdrop monolith **`advanceBackgroundSprite`** (0x2f71), and the object/actor movers
  (`advanceObjectMovers` 0x312d, `advanceActorMovers` 0x3a13, `loc_3748`, `loc_316f`). The routines
  are pinned; the mover axis (X vs Y under ROT90) stays the open question above.
- **What the background sprite is.** `BG_SPRITE_*` bounces horizontally and falls vertically
  (RNG-reseeded) — plausibly the patrolling top-band **UFO**, but the routine→on-screen-object link
  is **[guess]**.
- **The bottom creatures** and the "ZUN…" label (enemy name unread); which enemy the two-sprite
  actor / the `loc_38c8` family drives is not pinned.
- **Win / lose conditions and the round timer** — the `LEVEL`-scaled countdowns are visible, but the
  exact clear/death gates are not yet decompiled.
- **The elevator / shaft** the player starts in (top-left green structure) — lift or just the entry?

## Pixel-testing status

1. **Title / attract — ✅ PASSING**: `machine.js` + `render.js` render our live state through
   `video.js`; the pixel diff vs the certified MAME golden is **302 / 304 frames pixel-exact** (2
   transient sub-frame-jitter frames inside the reconverge gate). The two render bugs found and
   fixed were the tilemap `+16` vtop and the sprite `−16` + clip rectangle.
2. **Gameplay sprites — partially confirmed**: sprite Y (`240 - spriteram`, then `−16`) and the
   sprite clip rectangle are **verified against a gameplay input-tape golden** (enemy sprites in the
   bottom band matched MAME to the pixel). A fuller live-gameplay pixel gate still wants a driving
   input tape (coin/start/move/dig) plus the entropy pin (enemy motion pulls from the RNG).

Golden: `out/golden/pixel/` (certified MAME reset run, `frames.rgb` + `state.bin`), plus staged
attract reference frames `out/golden/attract/{title_ref,demo_ref}.png` (gitignored, ROM-derived).
