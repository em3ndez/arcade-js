// SPDX-License-Identifier: GPL-3.0-only

/**
 * The Pit work-RAM constants for the idiomatic layer.
 *
 * Maps The Pit work RAM (0x8000-0x87FF) to meaningful names. The addresses stay
 * hex in `../translated/` on purpose — that layer is the oracle; this file is a
 * naming convenience for the idiomatic rewrite and is NEVER the source of truth
 * for behaviour.
 *
 * ★ PROVENANCE / CONFIDENCE (be honest — a wrong name is the sprite-record trap,
 * worse than a neutral hex address): every name here was PROPOSED from
 * cross-routine corroboration observed during translation — the same address
 * used with a consistent role across N independent routines. That is real
 * evidence, but it has NOT yet had the proposer≠confirmer adversarial
 * re-derivation the DK names got. Names are tagged:
 *   (strong) — consistent role across 10+ routines, or an unambiguous use.
 *   (fair)   — consistent across a few routines; role clear but not cross-checked.
 *   (weak)   — a single plausible reading; treat as a hint, verify before trusting.
 * A verification pass (control-poke / adversarial re-derivation) should confirm
 * these; until then the idiomatic layer may cite them but the pixel gate, not the
 * name, is the correctness authority.
 */

// ── Object / tile geometry (the probe + collision + tile-cell system) ─────────

/** Tracked-object X (column) coordinate — the probe point the collision/tile code reads and writes.
 *  Used across 21 routines (movement, collision loc_03e8, tile-classify, spawns). (strong) */
export const OBJ_X = 0x8068;

/** Tracked-object Y (row) coordinate — paired with OBJ_X as the probe point. Used across 17 routines
 *  ("column"/"reload column" in the movers loc_1a40/loc_1a21). (strong) */
export const OBJ_Y = 0x806b;

/** Tile-cell COLUMN byte fed to the (row,col)→tilemap-offset calc (loc_3dae-style). Paired with
 *  TILE_ROW; both written by the fill/stamp setup (loc_4e1b/loc_4e55). (fair) */
export const TILE_COL = 0x8058;

/** Tile-cell ROW byte fed to the tilemap-offset calc; paired with TILE_COL (loc_4e20/loc_4e5a). (fair) */
export const TILE_ROW = 0x8059;

/** 16-bit pointer to the actor's current video-RAM display cell (loaded into IX via `ld ix,(0x806e)`
 *  by the draw/dispatch code loc_174f/loc_1a66). (strong) */
export const ACTOR_CELL_PTR = 0x806e;

// ── Sprite / animation ────────────────────────────────────────────────────────

/** Current sprite/animation frame code for the actor being drawn (`ld (0x8069),a` with 0x34/0xb4/…;
 *  "default sprite code" / "arm 0x35 event"). Used across 19 routines. (strong) */
export const SPRITE_CODE = 0x8069;

// ── Game mode / round state ───────────────────────────────────────────────────

/** Game mode / player-count cell — read as "player count" (loc_475d) and as the round/mode gate
 *  (`cp 3` in loc_02fd, decremented per-player in the teardown loc_0371). Used across 17 routines.
 *  (fair — the player-count vs mode-index dual use isn't fully pinned). */
export const GAME_MODE = 0x8001;

/** Secondary game-state byte armed to 1 or 2 alongside GAME_MODE (loc_038b/loc_03b2 `(0x8002)=1/2`).
 *  Gates the 2P/second-record path (loc_3a13's 0x8078 sibling). (fair) */
export const GAME_STATE2 = 0x8002;

/** Board/entry-select mode byte — the value the multi-door entry family stows before the shared body
 *  (loc_4b40/4b44/4b46 "entry-selected byte", "mode/variant"). Used across 17 routines. (fair) */
export const BOARD_MODE = 0x8057;

/** Variant selector read at round setup (loc_0391/loc_03a5) and by the fill dispatch (loc_4e2e
 *  "variant selector"). (weak) */
export const VARIANT = 0x8048;

// ── Player dig / movement ─────────────────────────────────────────────────────

/** The attract demo's generated steering command: one of four one-hot move directions
 *  (0x01/0x02/0x04/0x08, never combined), seeded once at round start and then written per active
 *  frame by steerDemoPlayer, and read by the movement dispatcher IN PLACE OF the joystick when the
 *  game-mode byte is >= 3 — a synthetic move direction, NOT a mask of blocked directions.
 *  (strong — proven one-hot by observation.) */
export const DEMO_STEER_DIR = 0x801b;

/** Climb / vertical-move gate the actor dispatch tests before the vertical branch (loc_1a02
 *  "climb/vertical gate"). (weak) */
export const CLIMB_GATE = 0x8080;

// ── Actor records: primary + its "twin" (shadow/second sprite) ───────────────
// The spawn/init code (loc_37cf/38c8/3984) seeds a primary block at 0x810a.. and a mirrored twin
// at 0x811b..; the movers (loc_3968) advance both. Fields corroborated by the "primary"/"twin",
// "X/coord", "tile", "Y" annotations across 6-7 routines each.

export const ACTOR_X = 0x810a; // primary actor X / coord (fair)
export const ACTOR_TILE = 0x810b; // primary actor tile field (fair)
export const ACTOR_Y = 0x810d; // primary actor Y (fair)
export const TWIN_X = 0x811b; // twin (shadow) X / coord (fair)
export const TWIN_TILE = 0x811c; // twin tile field (fair)
export const TWIN_CLEAR = 0x811e; // twin mirror clear byte (weak)

/** Spawn/alt-phase flag — set 0xff to mark "spawned", tested to gate the alt-phase spawn (loc_37cf
 *  "alt-phase byte", loc_37e4 "mark", loc_3776 "mark spawned (0xff)"). Used across 6-9 routines. (fair) */
export const SPAWN_PHASE = 0x807b;

/** Actor cadence timer — reloaded and counted down to pace the actor/enemy (loc_3800/loc_38f6
 *  "timer", loc_3786). (fair) */
export const ACTOR_TIMER = 0x8112;

/** Actor state/timer + sprite-code byte re-armed by the mover epilogue (loc_34fa "re-arm the
 *  state/timer byte", loc_34cf "store sprite code"). (weak) */
export const ACTOR_STATE = 0x8084;

// ── Free-running counters ─────────────────────────────────────────────────────

/** Per-frame animation/random counter (loc_3490 reads it as "frame counter"; loc_34f5 stores a
 *  "masked random byte" — an LFSR-seeded per-actor field). (weak — dual reading). */
export const ANIM_RAND = 0x808b;

/** Frame counter cleared at reset/round init (loc_4dfa "clear frame counter", read by loc_03e8's
 *  30-frame gate and loc_374f). (fair) */
export const FRAME_COUNTER = 0x8010;

// ── Sound ─────────────────────────────────────────────────────────────────────

/** Sound-command ring HEAD index (mod 8) — advanced by the shared enqueue tail loc_4ca5
 *  (`ld a,(0x801e) / inc / and 7 / ld (0x801e),a`). (strong). */
export const SOUND_HEAD = 0x801e;

/** Sound-command ring BUFFER base (8 slots) — the enqueue writes `(code|0x80)` at 0x8020+head. (strong). */
export const SOUND_RING = 0x8020;

// ── Tile-classifier scratch (0x80a5/0x80a8 — the tile-under-object block; note that
//    0x80a2/0x80a3/0x80a4 in this range are the reaction state-machine, see REACTION_STATE) ─
export const CUR_TILE = 0x80a5; // saved current tile under the object (loc_1840 "saved current tile") (fair)
export const NEXT_TILE = 0x80a8; // next-tile slot, pre-cleared before classify (loc_1706) (fair)

// ═══ NAMING PASS 2026-07-26 ═══════════════════════════════════════════════════
// Below: names added by the proposer≠confirmer pass (two agents independently derived
// each address's role from code evidence, blind to each other; only convergent ones are
// here) plus three pairs the input-tape / NMI-debounce work confirmed this session.

// ── Input debounce (the NMI loc_0066 samples + debounces the two ports) ───────
// Confirmed by the input-tape + NMI-debounce work: the NMI reads a port, compares to the
// previous sample, and latches the stable value. Idle IN0 reads 0x00 (input_port_0_r
// complements the active-low switches), idle IN1 0x00.

/** Debounced IN0 (joystick + dig) — the stable value the NMI latches after two equal reads
 *  of 0xA000; the movement/action code reads THIS, not the raw port. (strong) */
export const IN0_DEBOUNCED = 0x8018;
/** Previous IN0 sample, rolled each frame for the debounce compare. (strong) */
export const IN0_PREV = 0x8019;
/** Debounced IN1 (coin/start) — stable latched value the coin/credit logic reads. (strong) */
export const IN1_DEBOUNCED = 0x8015;
/** Previous IN1 sample, rolled for the debounce. (strong) */
export const IN1_PREV = 0x8016;

// ── PRNG (the advanceRandom LFSR, little-endian 16-bit) ───────────────────────
/** PRNG state low byte — also the returned random draw. advanceRandom (0x4b1a) shifts the
 *  16-bit {high,low} right with a feedback bit = low bit1 XOR bit2. (strong) */
export const PRNG_LOW = 0x800d;
/** PRNG state high byte. (strong) */
export const PRNG_HIGH = 0x800e;

// ── Round / difficulty ────────────────────────────────────────────────────────
/** Current player's LEVEL / round counter — inits to 1, +1 per level cleared; every
 *  difficulty subsystem scales off it (countdowns, reloads). Proposer≠confirmer converged,
 *  both strong: init=1 (loc_022d), inc (loc_02fd), scaled in loc_23e8/loc_031a/loc_2f2f. (strong) */
export const LEVEL = 0x8028;

// ── Shared tile/colour column-plotter parameter block (0x8055-0x8060) ─────────
/** Run length for the shared column plotter — how many cells the copy/fill helpers
 *  (loc_3dea/loc_3ddb/fillColourColumn) paint straight down a map column (djnz count,
 *  stride 0x20 = one screen row). Staged by ~18 painter routines before each draw call.
 *  Proposer≠confirmer converged, both strong. Sits beside TILE_COL/TILE_ROW. (strong) */
export const PLOT_RUN_LENGTH = 0x8055;

// ── Dig-object spawn ──────────────────────────────────────────────────────────
/** Active-spawn state of the dig-triggered tile object: 0 = idle (a new spawn is permitted),
 *  non-zero = a spawn sequence is active (value indexes its progress; gates re-spawn/awards).
 *  set=1 on spawn (loc_2c04), decremented per commit (loc_29ad), cleared on reset/boundary.
 *  Proposer≠confirmer converged, both fair. (fair) */
export const SPAWN_STATE = 0x80bd;

// ── Per-object reaction state machine (first field of the 0x80a2-0x80a9 block) ─
/** Per-object reaction/animation state selector: 0 = idle (normal per-frame movement runs),
 *  1-4 = a specific collision/dig/push reaction is armed + playing; also a busy-lock that
 *  defers the normal frame. Armed to 1-4 by loc_14cd/1515/1568/1704/191f, dispatched by
 *  loc_24f3, deferred by loc_1420, render-Y-biased at ==4. Proposer≠confirmer converged,
 *  both strong. (strong) */
export const REACTION_STATE = 0x80a2;

// ── Under-tile latches (the classify ladder records these when the tracked object aligns
//    on a special tile: 0x27 -> GOAL_TILE_LATCH, 0x26 -> FEATURE_TILE_LATCH) ──────────────
/** Latch set when the tracked object REACHES the special goal tile 0x27 (once past column
 *  0x53); tested nonzero to reroute state dispatch to the goal handler and enable the terrain
 *  scroll-reveal; cleared at init and on retreat (col < 0x53). Proposer≠confirmer converged on
 *  role (names MARKER/GOAL, confidence strong/fair). (fair) */
export const GOAL_TILE_LATCH = 0x80e7;
/** Latch set when the object's under-tile == 0x26 — a DISTINCT field from GOAL_TILE_LATCH's
 *  0x27 (the shared classify ladder loc_1568 records both adjacently, which is why the two
 *  look twinned). Gates the 0x3b-0x3d feature path (collectLootTile) and is cleared by a boundary
 *  one-shot (loc_167f/loc_1493, alongside SPAWN_STATE). NOT part of the 0x27 goal path.
 *  ★ Proposer≠confirmer BOTH converged on the wrong tile (0x27); the adversarial review
 *  corrected it to 0x26 — why the third review is load-bearing even after convergence. (fair) */
export const FEATURE_TILE_LATCH = 0x8076;

// ── Naming batch 2 (proposer≠confirmer, all 6 converged) ──────────────────────
/** Reaction step/animation countdown for the REACTION_STATE machine: reloaded from the period
 *  byte 0x80a3 when a reaction (1-4) is armed, decremented per frame by loc_24f3, and on zero
 *  ends the reaction (clears REACTION_STATE); the value 0x18 also cues a sound. (strong) */
export const REACTION_TIMER = 0x80a4;
/** X coordinate of the dig-spawned target/loot cell (>>3 -> tile column); paired with TARGET_Y,
 *  compared against OBJ_X for capture, folded into the VRAM cell address. (strong) */
export const TARGET_X = 0x80a9;
/** Y coordinate of the dig-spawned target/loot cell; paired with TARGET_X, compared vs OBJ_Y.
 *  (fair — the X/Y label is rotation-dependent, but it consistently pairs with OBJ_Y.) (fair) */
export const TARGET_Y = 0x80ac;
/** State/phase byte of the dig/carve object: discrete codes (0x30=carving, 0x09=done/target,
 *  0x10=spawn) branched on by loc_29ad, copied into the object's sprite record. (fair) */
export const DIG_OBJ_STATE = 0x80aa;
/** Second-stage goal-crossing latch, twin of GOAL_TILE_LATCH: set when the object reaches the
 *  0x27 goal tile past crossing-column 0x53; drives the post-goal crossing sequence (route to
 *  0x19d0, walk to the far edge, force the crossing sprite). (fair) */
export const GOAL_CROSSING_LATCH = 0x8077;
/** Fixed DSW/cabinet-derived pixel offset (0 in normal play) biased into sprite coordinates;
 *  computed once by the DSW decode loc_4b55. (strong) */
export const SPRITE_COORD_BIAS = 0x8051;

// ── Tracked-object state-control block (0x8079-0x807d) ────────────────────────
// A small control block for the tracked object that OBJ_X/OBJ_Y locate: a presence
// flag, a busy-this-frame flag (0x807a), a spawn sub-phase (SPAWN_PHASE 0x807b), a
// state timer, and a post-timer mode selector (0x807d). loc_13c9/loc_13de walk them
// as the head guards of the per-frame object/state dispatcher.

/** Presence flag for the tracked object (the one OBJ_X/OBJ_Y locate): 0 = no live object
 *  (skip its per-frame work), 0xff = present. Set 0xff when the object is first seeded
 *  (loc_3748, alongside its OBJ_X tile), cleared when it exits at a boundary (loc_384a,
 *  together with OBJ_X); read as the "nothing active, done" guard by the object/state
 *  dispatcher (loc_13de) and as the "nothing to classify" gate by loc_03e8. Consistent
 *  0/0xff presence role across 6 routines. (strong) */
export const OBJECT_ACTIVE = 0x8079;

/** State-lockout countdown for the tracked object: while nonzero the object is held in
 *  its current timed state and its normal per-frame processing is deferred — loc_13c9
 *  decrements it and returns early each frame (vectoring on the mode byte 0x807d when it
 *  expires), and loc_03e8 skips its recolour + classify while it runs. Armed to a duration
 *  at events (0x78 idle-arm in loc_384a; 0xb4 boundary latch in loc_19e3/loc_19d0/loc_2d6b).
 *  loc_13c9's translation reads it directly as "the countdown timer." (fair — the timer role
 *  is well corroborated, but it sits among sibling busy bytes 0x807a/0x807b and the latched
 *  values are not proven to be pure durations.) */
export const STATE_TIMER = 0x807c;
