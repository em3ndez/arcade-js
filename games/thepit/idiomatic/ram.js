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

/** Climb / vertical-move gate the actor dispatch tests before the vertical branch (stepObjectAndResolveTile
 *  "climb/vertical gate"). (weak) */
export const CLIMB_GATE = 0x8080;

// ── Actor records: a two-sprite actor (primary + its "twin") ─────────────────
// NOT a separate shadow entity: the spawners (loc_37cf/38c8/3984) seed a primary block at 0x810a..
// and a mirrored twin at 0x811b.., and descendActorToRest advances the primary then writes its
// value + 16 into the twin every step — a RIGID one-tile (16px) lock. Two hardware sprites moving as
// one unit at a fixed 16px offset = the two halves of a single ~32px-tall on-screen actor (the classic
// compose-a-tall-character-from-two-16px-sprites trick), NOT a trailing shadow. Rendered together by
// stageActorSpriteRecords. Distinct from the PLAYER (drawn via the tracked-object OBJ_X/OBJ_Y path).

export const ACTOR_X = 0x810a; // primary half: X / coord (fair)
export const ACTOR_TILE = 0x810b; // primary half: tile field (fair)
export const ACTOR_Y = 0x810d; // primary half: Y (fair)
export const TWIN_X = 0x811b; // twin half: X / coord, locked +16 to ACTOR_X (fair)
export const TWIN_TILE = 0x811c; // twin half: tile field (fair)
export const TWIN_CLEAR = 0x811e; // twin half: mirror clear byte (weak)

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
 *  both strong: init=1 (loc_022d), inc (loc_02fd), scaled in reseedColumnAnimation/loc_031a/loc_2f2f. (strong) */
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
// state timer, and a post-timer mode selector (0x807d). loc_13c9/advanceTrackedObject walk them
// as the head guards of the per-frame object/state dispatcher.

/** Presence flag for the tracked object (the one OBJ_X/OBJ_Y locate): 0 = no live object
 *  (skip its per-frame work), 0xff = present. Set 0xff when the object is first seeded
 *  (loc_3748, alongside its OBJ_X tile), cleared when it exits at a boundary (advanceAltPhaseActor,
 *  together with OBJ_X); read as the "nothing active, done" guard by the object/state
 *  dispatcher (advanceTrackedObject) and as the "nothing to classify" gate by loc_03e8. Consistent
 *  0/0xff presence role across 6 routines. (strong) */
export const OBJECT_ACTIVE = 0x8079;

/** State-lockout countdown for the tracked object: while nonzero the object is held in
 *  its current timed state and its normal per-frame processing is deferred — loc_13c9
 *  decrements it and returns early each frame (vectoring on the mode byte 0x807d when it
 *  expires), and loc_03e8 skips its recolour + classify while it runs. Armed to a duration
 *  at events (0x78 idle-arm in advanceAltPhaseActor; 0xb4 boundary latch in drawActorWalkFrame/loc_19d0/loc_2d6b).
 *  loc_13c9's translation reads it directly as "the countdown timer." (fair — the timer role
 *  is well corroborated, but it sits among sibling busy bytes 0x807a/0x807b and the latched
 *  values are not proven to be pure durations.) */
export const STATE_TIMER = 0x807c;

// ── Named by the adversarial RAM-naming pass: proposer≠confirmer + an independent judge,
//    by cross-routine consensus, keep-hex-if-ungrounded. Unlike the older names above,
//    these DID get the adversarial re-derivation. Tag (fair): grounded + cross-checked,
//    not yet pixel-verified — the pixel gate stays the correctness authority, not the name.

// ── Score (packed-BCD) + high-score display staging ──
/**
 *  SCORE_LO (0x8031) — Low packed-BCD byte of the active player's 2-byte score; BCD-added by
 *  loc_4683/4689, split to digits by loc_46af, read as hiscore candidate by loc_4d3a, cleared
 *  by resetScoreAndSoundQueue -- four independent users. (fair)
 */
export const SCORE_LO = 0x8031;
/**
 *  SCORE_HI (0x8034) — High packed-BCD byte of the active score paired with 0x8031, same four
 *  routines (loc_4689 carry target, loc_46af render with leading-zero blank, loc_4d3a
 *  candidate, resetScoreAndSoundQueue clear). (fair)
 */
export const SCORE_HI = 0x8034;
/**
 *  SCORE_DISPLAY_LOW (0x8037) — Low byte of the 16-bit score value staged by loc_4cca per
 *  high-score record and unpacked into digit tiles by loc_4d0c/unpackScoreDigits. (fair)
 */
export const SCORE_DISPLAY_LOW = 0x8037;
/**
 *  SCORE_DISPLAY_HIGH (0x8038) — High byte of the 16-bit score value staged at 0x8037 for the
 *  digit unpacker; written by loc_4cca, read MSB-first by loc_4d0c. (fair)
 */
export const SCORE_DISPLAY_HIGH = 0x8038;

// ── Tilemap write geometry + wait/glitter/step timers ──
/**
 *  FRAME_WAIT_COUNTDOWN (0x8009) — Per-frame countdown decremented each frame by the vblank
 *  NMI (loc_0066 ld/dec/ld) and armed+busy-waited to 0 by waitFrames/loc_4bff; both namers
 *  and my derivation agree, grounded in two independent routines. (fair)
 */
export const FRAME_WAIT_COUNTDOWN = 0x8009;
/**
 *  STEP_TIMER_BASE (0x804f) — DSW-decoded base (loc_4b55) that seeds the step timer 0x8067 =
 *  0x804f - 4*LEVEL (reseedColumnAnimation); 0x8067 is the per-step countdown advanceColumnAnimation decrements each
 *  frame. (fair)
 */
export const STEP_TIMER_BASE = 0x804f;
/**
 *  TILEMAP_OFFSET (0x805a) — 16-bit tilemap offset 32*row+col computed by loc_3dae from
 *  0x8059/0x8058 and consumed by loc_3dc9 to derive colour/video cursors; shared across ~10
 *  painter routines, both converged. (fair)
 */
export const TILEMAP_OFFSET = 0x805a;
/**
 *  GLITTER_COUNTDOWN (0x805c) — Free-running 8->1 (reload 8) per-frame countdown that
 *  loc_06ac uses to pace the diamond-glitter cell recolour, armed to 1 by
 *  loc_0673/paintScreen; role behaviorally pinned, both converged. (fair)
 */
export const GLITTER_COUNTDOWN = 0x805c;
/**
 *  COLOUR_RAM_CURSOR (0x805e) — 16-bit colour-RAM write cursor = tilemap offset + 0x8800
 *  colour base, stored by loc_3dc9 (paired with the 0x8060 video cursor) and walked down-
 *  column by the fillers loc_3e01/cyclePanelColumnColour/etc across ~10 routines. (fair)
 */
export const COLOUR_RAM_CURSOR = 0x805e;
/**
 *  COLUMN_ANIM_WRITE_PTR (0x8065) — 16-bit VRAM tilemap write cursor for the frame-gated
 *  column-reveal animation: seeded 0x9104 by reseedColumnAnimation, deref'd via IX and advanced +0x20/step
 *  then stored back by advanceColumnAnimation (fair)
 */
export const COLUMN_ANIM_WRITE_PTR = 0x8065;
/**
 *  COLUMN_ANIM_TIMER (0x8067) — per-step frame countdown pacing that same column animation:
 *  armed level-scaled (0x804f-4*LEVEL) by reseedColumnAnimation, decremented each frame by advanceColumnAnimation which
 *  runs the next step only when it expires (fair)
 */
export const COLUMN_ANIM_TIMER = 0x8067;

// ── Tracked-object tile cell + sprite attribute ──
/**
 *  OBJ_SPRITE_ATTR (0x806a) — object sprite attribute byte (palette bits0-2 + priority bit3):
 *  seeded 2 by loc_1362, copied by stageObjectSpriteRecord into sprite-record byte+2 (0x8222) which video.js
 *  decodes as color and priority (fair)
 */
export const OBJ_SPRITE_ATTR = 0x806a;
/**
 *  OBJ_TILE_COL (0x8071) — tilemap COLUMN cell under the tracked object, derived from
 *  position counter 0x806b (>>3), written by resolveObjectTile/1a02/14cd/16b9 and seeded 5; the low
 *  part of the 0x806e VRAM cell pointer (fair)
 */
export const OBJ_TILE_COL = 0x8071;
/**
 *  OBJ_TILE_ROW (0x8073) — tilemap ROW cell under the tracked object, derived from counter
 *  0x8068 (0x1f-((x+bias)>>3)), written by resolveObjectTile/1a02/167f/1493 and seeded 0x19; the *0x20
 *  major part of the 0x806e VRAM cell pointer (fair)
 */
export const OBJ_TILE_ROW = 0x8073;

// ── Probe-cell walk + sub-tile phase + mover dispatch state ──
/**
 *  PROBE_CELL_PTR (0x8089) — 16-bit VRAM/tilemap cell pointer (base 0x9000) written in
 *  loc_319d/loc_3289 and dereferenced+stepped ±0x20/row by the tile-probe helpers
 *  loc_33bc/33da/3410/3425; A, B and my derivation all agree, grounded across writer + four
 *  readers. (fair)
 */
export const PROBE_CELL_PTR = 0x8089;
/**
 *  SUBTILE_PHASE (0x808d) — Sub-tile phase / probe-table row index derived from the pixel
 *  position in loc_3289 and loaded as the DE row selector (D=0) by all four probe helpers
 *  (0x34fe/0x35fe ±0x20 rows); both namers and my derivation converge, grounded across five
 *  routines. (fair)
 */
export const SUBTILE_PHASE = 0x808d;
/**
 *  MOVER_STATE (0x8090) — Signed state byte of the 0x8083 move-object: loc_319d dispatches on
 *  its sign (neg->advanceDormantMover dormant tick, zero->arm 0x808b countdown, positive->player-box
 *  branch) and advanceDormantMover bumps it each call; both agree on the sign-dispatch role (B's
 *  unsupported 'ANIM' dropped). (fair)
 */
export const MOVER_STATE = 0x8090;

// ── Reaction object (position paired with the player box) ──
/**
 *  REACTION_OBJ_X (0x8094) — OBJ_X-paired position coordinate of the REACTION_STATE (0x80a2)
 *  entity: written each frame by loc_24f3 from OBJ_X±8, player-box-tested in loc_319d, placed
 *  by spawnDigEntity, written to sprite record byte 0, inited 0 by loc_24cf; both converge, well
 *  grounded. (fair)
 */
export const REACTION_OBJ_X = 0x8094;
/**
 *  REACTION_OBJ_Y (0x8097) — OBJ_Y-paired position coordinate of the REACTION_STATE (0x80a2)
 *  entity: written by loc_24f3 from OBJ_Y±8, player-box-tested in loc_319d against the 0x8086
 *  axis, written to sprite record byte 3, inited 0 by loc_24cf; both converge, well grounded.
 *  (fair)
 */
export const REACTION_OBJ_Y = 0x8097;

// ── Dig object record (attr / timer / subtype / arm-state) ──
/**
 *  DIG_OBJ_ATTR (0x80ab) — byte2 (color+priority attribute) of the dig-object sprite record
 *  built at 0x8228 by loc_2bd3; seeded to small color consts 0x06/0x07 by 5 writers
 *  (loc_287a/2d4e/2c04/2934/28ab); A/B and my derivation converge, consistent with the
 *  established DIG_OBJ_STATE=0x80aa family (fair)
 */
export const DIG_OBJ_ATTR = 0x80ab;
/**
 *  DIG_OBJ_TIMER (0x80b1) — countdown/animation timer for the dig object, armed to
 *  0x08/0x10/0x40 or reloaded from 0x80c2, decremented per frame and acted on at expiry
 *  across 7 routines (loc_2cb7/29ad/191f/2c04/28ab/2934/287a); strongly grounded, both namers
 *  agree (fair)
 */
export const DIG_OBJ_TIMER = 0x80b1;
/**
 *  DIG_OBJ_SUBTYPE (0x80c0) — sub-type/variant selector of the committed dig entity, written
 *  by spawnDigEntity and dispatched by loc_298a and loc_29ad (0=plain/ret, 2=special: arm timer +
 *  patch neighbour tiles to 0xc1); grounded across 4 routines, A/B converged (fair)
 */
export const DIG_OBJ_SUBTYPE = 0x80c0;
/**
 *  DIG_OBJ_ARM_STATE (0x80c1) — arm/capture state of the carve object
 *  (0=idle,1=armed/captured,2=latched): gates advanceTrackedObject dispatch, set by capture loc_2cb7 and
 *  arm triggerDigReaction, cleared with the block by loc_287a; grounded across 7 routines, role
 *  converged (name prefix normalised to the DIG_OBJ family) (fair)
 */
export const DIG_OBJ_ARM_STATE = 0x80c1;

// ── Background scroll sprite record (X / frame / attr / Y) ──
/**
 *  BG_SPRITE_X (0x80db) — X (byte0) of the animated background sprite; horizontal bounce
 *  oscillator in [0x19,0x38) (velocity 0x80df) init 0x28 by loc_2f2f, published as byte0 of
 *  the slot-3 record 0x822c; matches the ACTOR_X byte convention, A/B converged (fair)
 */
export const BG_SPRITE_X = 0x80db;
/**
 *  BG_SPRITE_FRAME (0x80dc) — sprite tile/frame code toggled 0x38<->0x39 every 8 frames
 *  (loc_2f71/2fc0/2fd9), init 0x39 by loc_2f2f, published as the code byte of the slot-3
 *  record; 4 users, both namers high-confidence agree (fair)
 */
export const BG_SPRITE_FRAME = 0x80dc;
/**
 *  BG_SPRITE_ATTR (0x80dd) — byte2 attribute (color low bits + priority) of the background
 *  sprite; bumped by loc_2f71 with `and 0xf7` holding priority bit3 clear while cycling
 *  color, init 0xc0 by loc_2f2f; role converged (A=COLOR/B=ATTR, normalised to ATTR per
 *  video.js decode) (fair)
 */
export const BG_SPRITE_ATTR = 0x80dd;
/**
 *  BG_SPRITE_Y (0x80de) — Y (byte3) of the animated background sprite; accelerating vertical
 *  fall (step 0x80e0) clamped at 0x86 then RNG-reseeded by loc_2f71, init 0x78 by loc_2f2f,
 *  published as byte3 of the slot-3 record; matches ACTOR_Y byte convention, A/B converged
 *  (fair)
 */
export const BG_SPRITE_Y = 0x80de;

// ── Column-reveal animation (phase / period / gate / cursor) ──
/**
 *  ANIM_PHASE_COUNTER (0x80e3) — Down-counter mod 8: decremented per frame, reloads 8 on wrap
 *  and toggles sprite frame 0x80dc, low bits gate the oscillator; read by advanceBackgroundAnimation and
 *  loc_2f71, seeded 1 by loc_2f2f — A and B agree, derivation confirms. (fair)
 */
export const ANIM_PHASE_COUNTER = 0x80e3;
/**
 *  REVEAL_PERIOD (0x80e4) — Level-derived reload period (7..3 via A^=0x07 from 0x8028) for
 *  the reveal gate 0x80e5; written by loc_2f2f, consumed by revealTerrainColumn/loc_2f71 on gate wrap —
 *  both namers converge, derivation confirms. (fair)
 */
export const REVEAL_PERIOD = 0x80e4;
/**
 *  REVEAL_GATE (0x80e5) — Per-column frame-gate down-counter: decremented each call, on wrap
 *  reloads from REVEAL_PERIOD 0x80e4 and reveals one terrain column; revealTerrainColumn/loc_2f71,
 *  seeded 1 by loc_2f2f — grounded and convergent. (fair)
 */
export const REVEAL_GATE = 0x80e5;
/**
 *  REVEAL_CURSOR (0x80e6) — Byte offset into tile-pattern table 0x3048, stepped back 6 per
 *  reveal (underflow ends reveal), seeded 0x96 by loc_2f2f; advanced by revealTerrainColumn/loc_2f71 and
 *  independently tested ==0 by dispatcher advanceTrackedObject as the reveal-finished gate. (fair)
 */
export const REVEAL_CURSOR = 0x80e6;

// ── Object 1 record + Object 2 record ──
/**
 *  OBJ1_X (0x80e8) — Base (offset 0) of the first object record: seeded/reset 0xec
 *  (seedObjectRecords/loc_319d), copied to sprite record 0x8230 byte 0 by loc_312d — the SAME structural
 *  field as OBJ2_X (0x80f9), so X by the house convention (offset 0 = X, ACTOR_X/OBJ_X). Under
 *  ROT90 the sprite's hardware-Y byte is the on-screen horizontal, which the codebase calls X.
 *  (The record's Y is the offset-3 byte 0x80eb, still hex.) (fair)
 */
export const OBJ1_X = 0x80e8;
/**
 *  OBJ1_SPRITE_CODE (0x80e9) — Object-1 record byte1: seeded 0x09 by seedObjectRecords, copied to
 *  sprite byte 0x8231 by loc_312d; video.js decodes it as code&0x3f + flipX(0x40) +
 *  flipY(0x80) — sprite code+orientation confirmed. (fair)
 */
export const OBJ1_SPRITE_CODE = 0x80e9;
/**
 *  OBJ1_ATTR (0x80ea) — Object-1 record offset 2: seeded 0x04 (seedObjectRecords), copied verbatim to
 *  sprite-record byte 2 (loc_312d), color-cycled with priority bit 3 held clear (advanceDormantMover) --
 *  A/B and my derivation all agree. (fair)
 */
export const OBJ1_ATTR = 0x80ea;
/**
 *  OBJ1_MOVE_PERIOD (0x80f6) — Object-1 record offset 14: seedObjectRecords derives 7-(LEVEL&6)
 *  (faster as level climbs) and loc_3490 reloads the offset-8 cadence timer from it -- A/B
 *  converge (reload/period) and my derivation agrees, grounded across two routines. (fair)
 */
export const OBJ1_MOVE_PERIOD = 0x80f6;
/**
 *  OBJ1_TARGET_COL (0x80f8) — Object-1 record offset 16 target column: seeded 0x04
 *  (seedObjectRecords); loc_319d fast-exits when 0x807a equals it and keys the tile-probe/direction
 *  dispatch on it -- A/B and my derivation agree. (fair)
 */
export const OBJ1_TARGET_COL = 0x80f8;
/**
 *  OBJ2_X (0x80f9) — Base (offset 0) of the second 17-byte object record: staged/emitted as
 *  sprite byte 0 by loc_316f, position-tested in loc_319d, seeded 0x00; matches house
 *  convention ACTOR_X=offset 0 -- A/B agree. (fair)
 */
export const OBJ2_X = 0x80f9;
/**
 *  OBJ2_TILE (0x80fa) — Object-2 record offset 1 sprite tile/code byte: seeded 0x09, emitted
 *  verbatim to sprite byte 1 (loc_316f), rewritten with the direction/orientation code
 *  (loc_319d/loc_3476); matches house convention ACTOR_TILE=offset 1 -- A/B agree. (fair)
 */
export const OBJ2_TILE = 0x80fa;
/**
 *  OBJ2_ATTR (0x80fb) — Object-2 record offset 2 attr/color byte: seeded 0x04, emitted to
 *  sprite byte 2, color-cycled with priority bit 3 held clear by advanceDormantMover -- same field as
 *  OBJ1_ATTR; A/B and my derivation agree. (fair)
 */
export const OBJ2_ATTR = 0x80fb;

// ── Actor per-frame step + twin timer + saved cell pointer ──
/**
 *  ACTOR_STEP_X (0x810e) — Low byte of the actor 16-bit step vector: loc_3748 loads it into L
 *  and adds it to ACTOR_X (0x810a) each cadence tick; seeded 0xff(-1)/0 by
 *  loc_36fe/3767/38c8. Real reader, A and B agree, my derivation confirms. (fair)
 */
export const ACTOR_STEP_X = 0x810e;
/**
 *  ACTOR_STEP_Y (0x810f) — High byte of the actor step vector: loc_3748 loads it into H and
 *  adds it to ACTOR_Y (0x810d) each cadence tick; seeded alongside 0x810e. Real reader, A and
 *  B agree, my derivation confirms. (fair)
 */
export const ACTOR_STEP_Y = 0x810f;
/**
 *  TWIN_TIMER (0x8123) — Both namers converged and my derivation agrees: twin of
 *  ACTOR_TIMER(0x8112); record+8 -> scratch 0x808b, decremented/reloaded as the cadence
 *  countdown by loc_319d (0x31b1) and armed (0xb4/0x01) by the spawn seeders. Grounded across
 *  seeders + 319d; primary ACTOR_TIMER already named, so pairing is consistent. (fair)
 */
export const TWIN_TIMER = 0x8123;
/**
 *  SAVED_CELL_PTR (0x8134) — Both namers converged and my derivation agrees: a 16-bit scratch
 *  slot holding a tilemap cell pointer. loc_33da and loc_3425 each do 'ld (0x8134),hl' (save
 *  advanced/one-row-back cursor) then 'ld ix,(0x8134)' a few instructions later. Grounded
 *  across two neighbour-search routines as a within-search save/restore. (fair)
 */
export const SAVED_CELL_PTR = 0x8134;

// ── Clarify pass 2026-07-27 (proposer≠confirmer + judge; the loot/dig/sprite subsystems
//    that the batch-3/4/5 decompiles made legible). (fair) unless noted. ──────────────

// ── Loot pickup counters + high-score table ──
/**
 *  LOOT_10PT_COUNT (0x8081) — Count of +10 loot pickups: tile-0x3a path calls the +10 award
 *  (loc_467b, bc=0x0010) then increments it; seeded 0, bumped by the collect handlers, read
 *  by showBonusScreen as a completion threshold (==4); +10 value verified. (fair)
 */
export const LOOT_10PT_COUNT = 0x8081;
/**
 *  LOOT_20PT_COUNT (0x8082) — Count of +20 loot pickups: tile-0x3b/3c/3d path calls the +20
 *  award (loc_4683, bc=0x0020) then increments it (latch 0x8078 gated); seeded 0, read by
 *  showBonusScreen (==3); +20 value verified. (fair)
 */
export const LOOT_20PT_COUNT = 0x8082;
/**
 *  HIGH_SCORE_TABLE (0x8039) — Base/top rank of the descending three-entry high-score table
 *  (5-byte records: 3 initials + 16-bit score at 0x8039/0x803e/0x8043); seeded by loc_4bc7,
 *  rendered by loc_4cca, ranked-inserted with 0xFF initials placeholders by loc_4d3a, blitted
 *  by loc_4df8. (fair)
 */
export const HIGH_SCORE_TABLE = 0x8039;

// ── Object phase/step + mover direction ──
/**
 *  OBJECT_PHASE (0x801a) — Tracked object's packed animation/command phase byte (high bits
 *  wind-up countdown stepped -0x20, low bits &0x0c = move command vs L); seeded 0 by
 *  loc_1362, reconciled each frame by windUpObjectMove, zeroed on the idle path by loc_144c. (fair)
 */
export const OBJECT_PHASE = 0x801a;
/**
 *  OBJ_STEP_X (0x806c) — Tracked object's per-frame X step: added to the committed OBJ_X
 *  (0x8068) by loc_184a, subtracted from it by loc_1659, low byte of the DE step-vector in
 *  advanceTrackedObject, seeded 1 by loc_1362; structural twin of the committed OBJ_X/ACTOR_STEP_X
 *  convention. (fair)
 */
export const OBJ_STEP_X = 0x806c;
/**
 *  OBJ_STEP_Y (0x806d) — Tracked object's per-frame Y step: added to the committed OBJ_Y
 *  (0x806b) by loc_19d0, subtracted by stepObjectAndResolveTile, high byte of the DE step-vector in advanceTrackedObject,
 *  seeded 1 by loc_1362; structural twin of the committed OBJ_Y/ACTOR_STEP_Y convention.
 *  (fair)
 */
export const OBJ_STEP_Y = 0x806d;
/**
 *  MOVER_DIRECTION (0x8092) — Published travel-direction index: stamped 0/1/2/3 by the four
 *  direction presets (loc_3476/347d/3484/348b) at 0x34a0, consumed by loc_319d's dec-a/jp-z
 *  direction fan-out at 0x32ce and 0x3345; A and B and my derivation all converge. (fair)
 */
export const MOVER_DIRECTION = 0x8092;

// ── Dig-entity staging (spawnDigEntity -> loc_2934 hand-off) + expected tile ──
/**
 *  EXPECTED_TILE (0x80a7) — The object cell's table-resolved expected tile: seeded from the
 *  raw under-tile then overwritten with the ROM lookup, cross-checked vs CUR_TILE 0x80a5 in
 *  loc_164f to detect a change, and stamped into (ix+0) by loc_24f3; both namers converged
 *  high-confidence, real readers + writers. (fair)
 */
export const EXPECTED_TILE = 0x80a7;
/**
 *  STAGED_TARGET_X (0x80b6) — Staged X coord = REACTION_OBJ_X-4 written by spawnDigEntity, promoted
 *  into TARGET_X 0x80a9 by loc_2934 and X-axis bbox-tested vs OBJ_X 0x8068 by loc_29ad; both
 *  namers converged, grounded across all three. (fair)
 */
export const STAGED_TARGET_X = 0x80b6;
/**
 *  STAGED_TARGET_Y (0x80b9) — Staged Y coord (OBJ_Y grid-snapped and lifted) written by
 *  spawnDigEntity, promoted into TARGET_Y 0x80ac by loc_2934 and Y-axis bbox-tested vs OBJ_Y 0x806b
 *  by loc_29ad; both namers converged, grounded across all three. (fair)
 */
export const STAGED_TARGET_Y = 0x80b9;
/**
 *  STAGED_CELL_PTR (0x80ba) — 16-bit copy of ACTOR_CELL_PTR 0x806e saved by spawnDigEntity and
 *  reloaded into the live carve cursor 0x80af by loc_2934; both namers converged and
 *  SAVED_CELL_PTR is already taken by 0x8134 in ram.js, so STAGED_CELL_PTR is the correct
 *  distinct name. (fair)
 */
export const STAGED_CELL_PTR = 0x80ba;
/**
 *  STAGED_DIG_TIMER (0x80bc) — spawnDigEntity writes REACTION_PERIOD<<1 here; loc_2934 promotes it
 *  verbatim into the named DIG_OBJ_TIMER (0x80b1) -- a clean single writer/reader staging
 *  cell for the dig timer, A+B converged. (fair)
 */
export const STAGED_DIG_TIMER = 0x80bc;
/**
 *  STAGED_DIG_SPRITE_ID (0x80bf) — spawnDigEntity stages the classified dig-entity id here;
 *  loc_2934 stamps it into the tilemap cell before the carve cursor (mem[cellPtr-1]) -- clean
 *  writer/reader pair, A+B converged. (fair)
 */
export const STAGED_DIG_SPRITE_ID = 0x80bf;

// ── Sprite record attributes + staging buffer base + loop counter ──
/**
 *  ACTOR_ATTR (0x810c) — Byte+2 of the primary sprite record 0x810a: loc_3a4c copies it to
 *  sprite-RAM byte2 (0x823a), which video.js decodes as color(bits0-2)+priority(bit3); seeded
 *  by all four spawners. Grounded, A+B converged. (fair)
 */
export const ACTOR_ATTR = 0x810c;
/**
 *  TWIN_ATTR (0x811d) — Byte+2 of the twin record 0x811b; loc_3a4c copies it to sprite-RAM
 *  byte2 (0x823e), decoded as color+priority by video.js -- mirror of ACTOR_ATTR, same
 *  seeders. Grounded, A+B converged. (fair)
 */
export const TWIN_ATTR = 0x811d;
/**
 *  SPRITE_STAGING_BASE (0x8220) — Base of the 32-byte (8x4) sprite-record staging buffer the
 *  NMI loc_0066 LDIRs to hardware sprite RAM 0x9840 each frame; filled by
 *  stageObjectSpriteRecord/stageActorSpriteRecords, wiped by clearSpriteStagingBuffer.
 *  Grounded, A+B converged. (fair)
 */
export const SPRITE_STAGING_BASE = 0x8220;
/**
 *  LOOP_COUNTER (0x800a) — Memory-resident down-counter seeded to an iteration count then
 *  decremented to 0 to repeat a loop body; grounded identically across setup-repeat
 *  loc_02ca/loc_02e1, screen-hold loc_3a6f, and animation-tier showBonusScreen. (fair)
 */
export const LOOP_COUNTER = 0x800a;

// ═══ NAMING PASS 2026-07-27 (full-decompile: credit/coin/mode + object/mover records) ═══════
// proposer≠confirmer over the whole 169-routine layer; write-only/dead/mixed-role cells left hex
// (0x801d/0x812d/0x8050/0x8052 mode+flip shadows are write-only; player-record backups stay hex).

/** CREDIT_COUNT (0x8000) — the credit counter: banked from the coin lines (clamp 9), spent on start;
 *  the corruption-watchdog anchor (serviceVblankNmi cold-boots if the mirrors disagree); loc_01f9
 *  tests it >0 to show the credit screen. (strong) */
export const CREDIT_COUNT = 0x8000;
/** CREDIT_MIRROR_A (0x801c) — redundant copy of CREDIT_COUNT, read by the corruption watchdog. (strong) */
export const CREDIT_MIRROR_A = 0x801c;
/** CREDIT_MIRROR_B (0x812c) — third redundant copy of CREDIT_COUNT, also watchdog-read. (strong) */
export const CREDIT_MIRROR_B = 0x812c;
/** COIN_SW_ACCUM (0x8003) — coin switch (IN1 bit0) edge-detect accumulator (0x55/0xaa); a completed
 *  pulse banks a credit. (strong) */
export const COIN_SW_ACCUM = 0x8003;
/** START1_SW_ACCUM (0x8004) — 1P-start switch (IN1 bit2) edge accumulator; a completed pulse pays a
 *  credit and starts a 1-player game. (strong) */
export const START1_SW_ACCUM = 0x8004;
/** START2_SW_ACCUM (0x8005) — 2P-start switch (IN1 bit1) edge accumulator; starts a 2-player game. (strong) */
export const START2_SW_ACCUM = 0x8005;
/** FRAME_COUNTER_PRESCALER (0x8007) — /60 down-divider; on rollover reloads 60 and ticks FRAME_COUNTER. (strong) */
export const FRAME_COUNTER_PRESCALER = 0x8007;
/** MAIN_LOOP_DELAY (0x8011) — per-frame busy-wait length mainLoop burns; seeded = LOOP_DELAY_BASE − LEVEL
 *  (higher level → faster). (strong) */
export const MAIN_LOOP_DELAY = 0x8011;
/** SOUND_TAIL (0x801f) — sound-command ring READ/dequeue index (mod 8); pairs with SOUND_HEAD/SOUND_RING. (strong) */
export const SOUND_TAIL = 0x801f;
/** MEN_LEFT (0x802b) — active player's working men/lives count; drawn by drawMenLeftPanel, docked at a
 *  round boundary, seeded from STARTING_MEN. Field 1 of the player record; P1/P2 backups 0x802c/0x802d kept hex. (strong) */
export const MEN_LEFT = 0x802b;
/** INITIALS_REMAINING (0x804b) — high-score initials-entry down-counter (seeded 3, →0 ends entry). (strong) */
export const INITIALS_REMAINING = 0x804b;
/** COINS_PER_CREDIT_A (0x804c) — DSW coin cost for coin line 2 (0 = free play). NOT bonus/lives. (strong) */
export const COINS_PER_CREDIT_A = 0x804c;
/** COINS_PER_CREDIT_B (0x804d) — DSW coin cost for coin line 3. (strong) */
export const COINS_PER_CREDIT_B = 0x804d;
/** LOOP_DELAY_BASE (0x804e) — DSW main-loop pacing base that MAIN_LOOP_DELAY derives from. (strong) */
export const LOOP_DELAY_BASE = 0x804e;
/** STARTING_MEN (0x8053) — DSW starting lives ((dsw&0x40)?4:3); startGame seeds MEN_LEFT from it. (strong) */
export const STARTING_MEN = 0x8053;
/** REACTION_OBJ_CODE (0x8095) — sprite/frame-code byte (byte1) of the reaction object's 4-byte record
 *  (ends REACTION_OBJ_X/Y already named). (strong) */
export const REACTION_OBJ_CODE = 0x8095;
/** REACTION_OBJ_ATTR (0x8096) — attribute/anim byte (byte2) of that reaction record. (strong) */
export const REACTION_OBJ_ATTR = 0x8096;
/** OBJ2_MOVE_PERIOD (0x8107) — OBJ2 mover cadence reload period; structural mirror of OBJ1_MOVE_PERIOD. (strong) */
export const OBJ2_MOVE_PERIOD = 0x8107;
/** OBJ2_TARGET_COL (0x8109) — OBJ2 mover target column (seed 5 → loc_319d steer path); mirror of OBJ1_TARGET_COL. (strong) */
export const OBJ2_TARGET_COL = 0x8109;
/** OBJ1_TIMER (0x80f0) — OBJ1 mover cadence/dwell countdown (record offset 8). (fair) */
export const OBJ1_TIMER = 0x80f0;
/** OBJ1_STATE (0x80f5) — OBJ1 mover signed state byte loc_319d sign-dispatches on (record offset 13). (fair) */
export const OBJ1_STATE = 0x80f5;
/** OBJ2_TIMER (0x8101) — OBJ2 mover cadence/dwell countdown (mirror of OBJ1_TIMER). (fair) */
export const OBJ2_TIMER = 0x8101;
/** OBJ2_STATE (0x8106) — OBJ2 mover signed state byte (mirror of OBJ1_STATE). (fair) */
export const OBJ2_STATE = 0x8106;
/** MOVER_MOVE_PERIOD (0x8091) — working-block mover cadence reload period (parallels OBJ1_MOVE_PERIOD). (fair) */
export const MOVER_MOVE_PERIOD = 0x8091;
/** MOVER_TARGET_COL (0x8093) — working-block mover target column loc_319d steers toward. (fair) */
export const MOVER_TARGET_COL = 0x8093;
/** CARVE_SEAM_LEFT (0x807e) — flag loc_29ad sets when a dug channel abuts the object's tile column on
 *  one side; loc_1493 reads it to defer that step. (fair — L/R axis under ROT90 unconfirmed) */
export const CARVE_SEAM_LEFT = 0x807e;
/** CARVE_SEAM_RIGHT (0x807f) — mirror seam flag for the opposite move arm (loc_167f reads it). (fair) */
export const CARVE_SEAM_RIGHT = 0x807f;
/** SCROLL_WINDOW_PTR (0x809a, 16-bit) — tilemap cell the horizontal terrain-scroll walker samples. (fair) */
export const SCROLL_WINDOW_PTR = 0x809a;
/** SCROLL_SUBPHASE (0x809e) — sub-tile column phase selecting the ROM stop-tile slice for the scroll. (fair) */
export const SCROLL_SUBPHASE = 0x809e;
/** DIG_SPAWN_QUEUE (0x80c3) — base of the 24-slot pending-spawn column queue (12 left paired to 12 right). (fair) */
export const DIG_SPAWN_QUEUE = 0x80c3;
/** SCORE_READOUT_STRIP (0x8280) — base of a 32-cell work-RAM display strip staging the rightmost
 *  on-screen score-readout column. (fair) */
export const SCORE_READOUT_STRIP = 0x8280;
/** ACTOR_SPRITE_SLOT (0x8238) — sprite-staging slot 6 (SPRITE_STAGING_BASE+24), the actor body's record. (fair) */
export const ACTOR_SPRITE_SLOT = 0x8238;
/** TWIN_SPRITE_SLOT (0x823c) — sprite-staging slot 7 (SPRITE_STAGING_BASE+28), the twin's record. (fair) */
export const TWIN_SPRITE_SLOT = 0x823c;
