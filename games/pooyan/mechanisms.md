# Pooyan — how the machine works

This document describes the running machine as it is now. It is regenerated whole each
understanding pass. Confidence tags mirror `idiomatic/names.js`: **[seen]** = confirmed by a
MAME golden observation, **[code]** = read from the translated behaviour with MAME-grounding
still open. At this stage the machine's **state architecture** is mapped — the work-RAM layout
and the variables the game runs on; routine-level mechanism sections accrue as the decompile
spiral climbs the call graph.

## The work RAM and its state model

All mutable game state lives in the 2 KB work RAM at `0x8800–0x8FFF` (colour RAM `0x8000`,
tile codes `0x8400`, and sprite banks `0x9000/0x9400` sit outside it). The low block
`0x8800–0x882f` holds the machine's configuration and top-level control; the middle
`0x8900–0x8bff` holds per-round game state and the actor arena's live page; the object record
tables occupy `0x8a80–0x8c7f`; and the high block `0x8d00–0x8fff` drives the wave, rope, launch
and display-list machinery.

## Configuration and coinage

Boot decodes the dip switches once into work RAM. `COINAGE_CONFIG` [seen] takes the DSW0 low
nibble through the coinage table at `0x0053` (`0x0f` means free play), and both goldens show it
settle at boot (frame 32). `DIFFICULTY_DSW` [code] holds the three difficulty bits from DSW1 bits
4–6 (the port is complemented before extraction, so the stored value is `(~DSW1>>4)&7`) that later
scale enemy spawn schedules and threshold tables; and `BONUS_AWARD_DSW` [code] selects the
extra-life award schedule off the (likewise complemented) DSW1 bit 3. These two are written only at
boot and left at their default zero, so they sit static in both goldens.

Credits and player selection follow from there. `CREDIT_COUNT` [seen] is a BCD counter that a
coin bumps and a start consumes — the gameplay golden shows it rise on the coin at frame 302 and
fall on the 1-player start at 362. `TWO_PLAYER_FLAG` [code] is set for a two-player game and, with
`ACTIVE_PLAYER` [seen] (bit 0 chooses the player-1 or player-2 register banks), routes per-player
state. Each player keeps a life count — `PLAYER0_LIVES` and `PLAYER1_LIVES` [seen], seeded from the
lives dip switch (`0x8807`, default three) at start; the active player's count drains on death (the
1-player goldens show `PLAYER0_LIVES` count down `3→2→1→0`, while `PLAYER1_LIVES` is only seeded and
cleared at game-over) — and the two `0x8940`/`0x8980` state banks
(`PLAYER0_STATE_BANK`/`PLAYER1_STATE_BANK` [code]) that swap with the live page `0x8900` when the
active player changes.

## The top-level state machine

Each vblank NMI reads `MAIN_GAME_STATE` [seen] and dispatches through the table at `0x06f0`
(handlers `072d`/`0899`/`0c4e`/`159b`/`0e53`) — the coarse attract/intro/play selector, which the
gameplay golden walks `0→1→2→3`. Once play begins, `GAME_ACTIVE_FLAG` [seen] gates the in-play
handlers (set at start-of-life, cleared at game-over; gameplay routines return early when it is
zero), and `PLAY_STATE_INDEX` [seen] is the in-play sub-state, masked `&0x1f` and dispatched
through the table at `0x15a8` to step the round and intro phases. `PHASE_TIMER` [seen] is the
general per-frame countdown the state handlers reload to time transitions, and `FRAME_COUNTER`
[seen] — decremented every NMI — paces animation and gates the periodic integrity checks, while
`SUBPHASE_TICK` [seen] is a short mod-`0x1c` cousin that advances a display sub-phase on each
wrap. Screen orientation is held in `FLIP_SCREEN_FLAG` [seen], copied to the flip-screen latch
`0xa187` bit 7 each NMI. Raw input arrives as `INPUT_PORT0` [seen], the inverted IN0 sample at the
head of the `0x8810` edge-detect ring (coin bit 0, 1-player-start bit 3, 2-player-start bit 4).

## The actor arena

The object records live in one zero-filled arena at `0x8a80–0x8c7f` (cleared at board init), a set
of `0x18`-stride record tables. `ACTOR_TABLE` [seen] is the base, its slot 0 the player/lead
actor; `ENEMY_ACTOR_TABLE` [seen] is the enemy sub-array `0x60` bytes in. Alongside sit the
specialised pools: `SPRITE_OBJECT_TABLE`, `PROJECTILE_TABLE`, `FORMATION_TABLE`,
`SPAWN_OBJECT_TABLE` [seen/code] and the two-entry I-parity enemy/target pair
`ENEMY_TARGET_REC0`/`REC1` [seen] (selected by the `I` register, not the player),
each a stride-`0x18` record whose byte 0 flags the slot active. The player actor's own fields are
`PLAYER_Y` [seen] (its vertical position, which enemy AI targets to arm dives), `LEAD_ACTOR_STATE`
[seen] (a 0–5 phase index into a six-way dispatch, cycling in the golden), and `PLAYER_AIM_FLAGS`
[code] (joystick bits plus the above/on-target/below aim indicator).

Population is bounded and timed. `ACTIVE_ENEMY_COUNT` [seen] rises on spawn and falls on despawn
against a cap, `ENEMY_SPAWN_TIMER` [seen] and `FORMATION_SPAWN_TIMER` [code] gate the spawn sweeps,
and collisions raise the I-parity-paired `OBJ_HIT_FLAG_I0`/`I1` [seen] (indexed by the `I`
register slot, not the player — both fire in a 1-player game) that a teardown routine clears
as it removes the struck object. `GRAB_ACTIVE_FLAG` [seen] latches while a rope-grab is in
progress, aborting spawn and event work until it clears.

The arena's records are built and driven by decompiled leaf primitives [code]: `initActorRecord`
stamps a fresh record's spawn constants and datum; `setActorAnimation` and
`storeActorAnimationPointer` install a record's animation-script pointer and reset its frame index;
`advanceFallStep` steps a falling actor one gravity increment and reports whether it is still above
its landing row; and `stampObjectAndDecCounter` marks an object's state bytes while decrementing a
shared counter.

## Waves, rope and launch

A round is a sequence of attack waves. `WAVE_INDEX` [seen] (`0x8f3d`) selects the wave and also
doubles as the wave's arrival target, which `WAVE_RECORDS_ARRIVED` [seen] is compared against to see
how many records have arrived; `WAVE_HOLD_TIMER` [seen] gates the inter-wave pause, and
`WAVE_PROGRESS_COUNTER` [seen]
ramps enemy aggressiveness as the wave advances. `STAGE_COUNTDOWN` [seen] counts a stage down from
`0x20` and selects the stage label at its initial value.

The rope/lift machinery counts segments in `ROPE_SEGMENT_COUNT` [seen] (stepped up toward the
per-round bound) and draws them via `ROPE_DRAW_COUNT` [code]. The arrow/rope launch is a small
state machine: `LAUNCH_STATE` [seen] dispatches the per-frame driver, `LAUNCH_ARM_LATCH` [seen]
and `LAUNCH_ARMED_FLAG` [seen] arm a shot, and lane activity is paced by `ACTIVE_LANE_COUNT` [seen]
and the `LANE_SPAWN_COUNTDOWN` [seen] that suppresses enemy fire while a lane sequence runs. The
enemy formation gathers, launches and tears down through `FORMATION_STATE` [code] and
`WAVE_TEARDOWN_STATE` [code], and the boss/enemy phase latches its screen-X in `LATCHED_ENEMY_X` [seen].

## Rendering, HUD and display lists

Sprites are marshalled through `SPRITE_DISPLAY_LIST` [seen], the base of a 24-entry list rebuilt
each frame and mirrored out, with `SPRITE_ACTOR_RECORD_SLOTS` and `SPRITE_TARGET_SLOTS` [seen] the
stride-4 record and collision-target views the DMA and proximity scans walk. The tilemap is filled
row-by-row using the paired `FILL_ROW_COUNTER` [seen] and `TILE_FILL_PTR` [seen] (advanced `+0x20`
per row). Per-actor animation is driven through `ANIM_SCRIPT_CURSOR` [seen] (a cursor over the
per-actor ROM animation script) and `TILE_ANIM_CURSOR` [seen] (a video-RAM cursor that marches a
tile strip forward/back on alternating frames, writing tile codes directly into the tilemap). The
intro/attract text is emitted by the `SCRIPT_FRAME_TIMER`/`ATTRACT_SUBSTATE` [seen] pair through the
`SCRIPT_WRITE_PTR` [seen] VRAM write pointer. The HUD shows the round number
(`ROUND_COUNTER` [code], BCD-rendered) and a five-cell vertical gauge drained through
`GAUGE_PHASE_COUNTER` [seen]. The high score keeps its MSB in `HIGH_SCORE_BCD_HI` [seen] (compared
MSB-first when a new score beats it) and the sorted ten-entry table at `HIGH_SCORE_TABLE` [code].

Several rendering leaves are decompiled [code]: `splitBcdByte` peels a BCD byte into its two digits
and `drawStackedBcdDigits` paints them as a stacked pair (blanking a leading zero) for the HUD
counters; `paintColumnBodyTiles` stamps a column's two body tiles (the caller adds the cap) and
`blankTileColumn` blanks a three-cell column; and `clearBit2AcrossSixSlots` clears one attribute bit
across six strided table entries.

## Anti-tamper

Pooyan self-checks its ROM. `TAMPER_FREEZE_FLAG` [code] is a miss tally bumped by the checksum and
signature guards; when non-zero it freezes spawns, aborts actor updates and skips HUD setup. Two
further strike counters, `TAMPER_STRIKES_ROM` [code] (fed by the `0x64be` ROM checksum) and
`TAMPER_STRIKES_SIG` [code] (fed by the `0x5328`/`0x557f` signature checksums), record specific
guard failures. With an intact ROM none of these ever fire, so all three sit static at zero in both
goldens — their dead failure arms are the anti-tamper traps closed off in the translation layer.
