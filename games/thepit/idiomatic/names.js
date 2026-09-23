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
 * worse than a neutral hex address): every name carries an evidence-source tag —
 * the SAME vocabulary used for routines and in mechanisms.md — saying HOW we know
 * what the cell is:
 *   [seen]  — the cell's role was observed under MAME (a grounding capture / control-
 *             poke watched THIS address and confirmed what it does).
 *   [code]  — the role is understood from the routines that touch the address:
 *             consistent across them, but the cell itself was not observed. (Common.)
 *   [guess] — a single plausible reading, not yet confirmed; treat as a hint, verify.
 *   keep-hex — no confident name yet, so no const is created (the address stays a bare
 *             literal; the absence of an entry is itself the signal).
 * How broadly a name is corroborated ("used across N routines") lives in each cell's
 * prose, not as a separate grade. These tags were set under proposer≠confirmer (two
 * blind graders + an independent adjudicator, 2026-07-31); the pixel gate, not the
 * name, remains the correctness authority.
 * (Changed 2026-07-31: unified from the old strong/fair/weak *breadth* grade onto this
 * evidence-source axis — see docs/names-registry.md "One confidence vocabulary".)
 *
 * ★ GAMEPLAY-FIRST GROUNDING PASS (2026-07-29): the abstract code-only names
 * (OBJ_, ACTOR_/TWIN_, BG_SPRITE_, MOVER_ families) were replaced with the earned,
 * grounded gameplay vocabulary from `mechanisms.md` (commit d551751) — the player,
 * the three rival-explorer enemies, the Zonker tank, the laser, falling hazards.
 * `mechanisms.md` (two live MAME grounding rounds) is the authority and OVERRODE the
 * pre-grounding lap-2 map where they disagreed — most notably **0x810a is enemy #3,
 * a 2-sprite actor, NOT a "ship"** (§2.7). Cells whose grounded meaning is only
 * partly pinned keep an honest caveat in their docstring; genuinely ambiguous/shared
 * cells kept their prior names rather than over-committing to one role.
 */

// ── Player position (the tracked object OBJ_X/OBJ_Y located IS the player; §2.2/§2.10) ─────────
// Grounded axis (mechanisms §2.10, grounding-2 Z-8): the display is ROT270, so game-space
// player-Y renders screen-HORIZONTAL and player-X renders screen-VERTICAL. Named in game space.

/** Player Y (game-space) — work-Y at 0x8068; renders on the screen-HORIZONTAL axis under ROT270.
 *  Drives the tilemap ROW index (row = 31-((PLAYER_Y+3)>>3), ×32 stride). The collision/tile code and
 *  every mover read+write it. Used across 21 routines (movement, collision steerDemoPlayer, tile-classify,
 *  spawns). Grounded (§2.10). [seen] */
export const PLAYER_Y = 0x8068;

/** Player X (game-space) — work-X at 0x806b, paired with PLAYER_Y; renders screen-VERTICAL under ROT270
 *  (dig-mode drives the player DOWN the screen while PLAYER_X increases, §2.10). Drives the tilemap COLUMN
 *  index (col = (PLAYER_X-bias+5)>>3). Used across 17 routines. Grounded (§2.10). [seen] */
export const PLAYER_X = 0x806b;

/** Tile-cell COLUMN byte fed to the (row,col)→tilemap-offset calc (rowColToTileOffset-style). Paired with
 *  TILE_ROW; both written by the fill/stamp setup (loc_4e1b/loc_4e55). [seen] */
export const TILE_COL = 0x8058;

/** Tile-cell ROW byte fed to the tilemap-offset calc; paired with TILE_COL (loc_4e20/loc_4e5a). [seen] */
export const TILE_ROW = 0x8059;

/** 16-bit pointer to the actor's current video-RAM display cell (loaded into IX via `ld ix,(0x806e)`
 *  by the draw/dispatch code loc_174f/loc_1a66). [seen] */
export const PLAYER_CELL_PTR = 0x806e;

// ── Player facing / sprite frame ──────────────────────────────────────────────

/** Player facing + sprite-frame code (`ld (0x8069),a` with 0x32/0x33/0xb2/0xb3, bit7 = horizontal
 *  mirror; also 0x34/0xb4/0x35 anim frames). When facing is horizontal this **selects the laser
 *  direction** (§2.3, grounding forced 0x8069=0x32 to fire a rightward bolt). Used across 19 routines.
 *  Grounded (§2.2/§2.3). [seen] */
export const PLAYER_FACING = 0x8069;

// ── Game state / round ────────────────────────────────────────────────────────

/** Game state — 0 attract · 1 one-player game · 2 two-player · 3 credit-standby · 4 attract-demo.
 *  The input select reads the real joystick at states 0-2 and the synthetic demo stream at ≥3 (§2.1).
 *  Grounded (§2.1: coin→start→play pinned 0x8001 3→1 at f464). Used across 17 routines. [seen] */
export const GAME_STATE = 0x8001;

/** Active player index (1 or 2) — armed alongside GAME_STATE (loc_038b/loc_03b2 `(0x8002)=1/2`) and
 *  read on the P1↔P2 handoff. [seen] */
export const ACTIVE_PLAYER = 0x8002;

/** Board/entry-select mode byte — the value the multi-door entry family stows before the shared body
 *  (setupBoardMode90/blankScreen/setupBoardDisplay "entry-selected byte", "mode/variant"). Used across 17 routines. [seen] */
export const BOARD_MODE = 0x8057;

/** Variant selector read at round setup (loc_0391/loc_03a5) and by the fill dispatch (loc_4e2e
 *  "variant selector"). [seen] */
export const VARIANT = 0x8048;

// ── Player dig / movement ─────────────────────────────────────────────────────

/** The attract demo's generated steering command: one of four one-hot move directions
 *  (0x01/0x02/0x04/0x08, never combined), seeded once at round start and then written per active
 *  frame by steerDemoPlayer, and read by the movement dispatcher IN PLACE OF the joystick when the
 *  game-mode byte is >= 3 — a synthetic move direction, NOT a mask of blocked directions.
 *  (one-hot: exactly one of the four move-direction bits set). [seen] */
export const DEMO_STEER_DIR = 0x801b;

/** MOVE_BLOCK_FLAG (0x8080) — movement blocker. A falling rock/arrow overlapping the player sets it
 *  (`loc_2c04`), and the vertical/climb routine `loc_1a02` bails to its epilogue while it is nonzero —
 *  so hazards **freeze movement, they do not kill** (§2.5, grounded). (The earlier "climb gate" reading
 *  was refuted; it is a pure blocker.) [seen] */
export const MOVE_BLOCK_FLAG = 0x8080;

// ── Enemy #3 — a 2-sprite actor (primary 0x810a + twin 0x811b), NOT a "ship" (§2.7, grounded) ──
// One hardware slot, THREE grounded uses (G.17): (1) live enemy #3, a roaming rival explorer that is
// shootable like enemies 1&2 (loc_3a13 during 0x8010≥0x0a); (2) the board-intro set-piece — it flies
// the saucer + Zonker tank into place, which are then baked into the background tilemap and the sprite
// freed; (3) the escape rescue-ship when the mountain is gone (loc_384a → level advance).
// Structurally the primary (0x810a..) and its mirrored twin (0x811b.., locked +16px) compose one
// ~32px-tall actor rendered together by stageActorSpriteRecords. Distinct from the PLAYER (PLAYER_Y/PLAYER_X path).

export const ENEMY3_X = 0x810a; // primary half: X [seen]
export const ENEMY3_TILE = 0x810b; // primary half: sprite/tile field [seen]
export const ENEMY3_Y = 0x810d; // primary half: Y [seen]
export const ENEMY3_TWIN_X = 0x811b; // twin half: X, locked +16 to ENEMY3_X [seen]
export const ENEMY3_TWIN_TILE = 0x811c; // twin half: sprite/tile field [seen]
export const ENEMY3_TWIN_Y = 0x811e; // twin half: Y (record offset +3) [seen]

/** BOARD_END_PHASE (0x807b) — end-of-board state read when the mountain is gone (§2.6): 0 = idle
 *  (pure-idle case, just plays a sound), 1 = ESCAPE (player reached the top rung with treasure → forces
 *  the rescue ship down → level advance), ≥2 = done. Also gates enemy-3's alt spawn path (loc_3748).
 *  Grounded (§2.6). [seen] */
export const BOARD_END_PHASE = 0x807b;

/** Enemy-3 cadence timer (record offset 8, 0x810a+8) — reloaded and counted down to pace enemy #3
 *  (loc_3800/loc_38f6/loc_3786). [seen] */
export const ENEMY3_TIMER = 0x8112;

/** Enemy work-slot sprite/state byte (0x8083+1) — the sprite/orientation code of whichever enemy is
 *  currently ldir'd into the shared work slot; the enemy-catch sets it to 0x17 (§2.4). Re-armed by the
 *  mover epilogue (loc_34fa/loc_34cf). [seen] */
export const ENEMY_WORK_SPRITE = 0x8084;

// ── Free-running counters ─────────────────────────────────────────────────────

/** ENEMY_ACTION_TIMER (0x808b) — mover-record offset 8: a decrementing cadence/dwell timer every mover
 *  routine drives (stepEnemyMover dwell/respawn countdown; stepMoverUp/stepMoverDown/stepMoverMirrored/stepMoverUnmirrored per-step cadence),
 *  parallel to ENEMY1_TIMER/ENEMY2_TIMER. (The earlier "random/animation" reading is refuted.) [seen] */
export const ENEMY_ACTION_TIMER = 0x808b;

/** PLAY_PHASE_COUNTER (0x8010) — the board-startup ramp: cleared to 0 at reset/board rebuild, then
 *  ramped up as the intro stages into live play. A master gate — enemies 1&2 don't run until ≥8, enemy-3
 *  goes live and mountain erosion advances at ≥0x0a (live play consistently begins ~f1180). Also read by
 *  steerDemoPlayer's 30-frame gate. Grounded (§2.1). [seen] */
export const PLAY_PHASE_COUNTER = 0x8010;

// ── Sound ─────────────────────────────────────────────────────────────────────

/** Sound-command ring HEAD index (mod 8) — advanced by the shared enqueue tail enqueueSoundCommand
 *  (`ld a,(0x801e) / inc / and 7 / ld (0x801e),a`). [seen]. */
export const SOUND_HEAD = 0x801e;

/** Sound-command ring BUFFER base (8 slots) — the enqueue writes `(code|0x80)` at 0x8020+head. [seen]. */
export const SOUND_RING = 0x8020;

// ── Tile-classifier scratch (0x80a5/0x80a8 — the tile-under-object block; note that
//    0x80a2/0x80a3/0x80a4 in this range are the reaction state-machine, see REACTION_STATE) ─
export const CUR_TILE = 0x80a5; // saved current tile under the object (loc_1840 "saved current tile") [seen]
export const NEXT_TILE = 0x80a8; // next-tile slot, pre-cleared before classify (loc_1706) [seen]

// ═══ NAMING PASS 2026-07-26 ═══════════════════════════════════════════════════
// Below: names added by the proposer≠confirmer pass (two agents independently derived
// each address's role from code evidence, blind to each other; only convergent ones are
// here) plus three pairs the input-tape / NMI-debounce work confirmed this session.

// ── Input debounce (the NMI serviceVblankNmi samples + debounces the two ports) ───────
// Confirmed by the input-tape + NMI-debounce work: the NMI reads a port, compares to the
// previous sample, and latches the stable value. Idle IN0 reads 0x00 (input_port_0_r
// complements the active-low switches), idle IN1 0x00.

/** Debounced IN0 (joystick + dig) — the stable value the NMI latches after two equal reads
 *  of 0xA000; the movement/action code reads THIS, not the raw port. [seen] */
export const IN0_DEBOUNCED = 0x8018;
/** Previous IN0 sample, rolled each frame for the debounce compare. [seen] */
export const IN0_PREV = 0x8019;
/** Debounced IN1 (coin/start) — stable latched value the coin/credit logic reads. [seen] */
export const IN1_DEBOUNCED = 0x8015;
/** Previous IN1 sample, rolled for the debounce. [seen] */
export const IN1_PREV = 0x8016;

// ── PRNG (the advanceRandom LFSR, little-endian 16-bit) ───────────────────────
/** PRNG state low byte — also the returned random draw. advanceRandom (0x4b1a) shifts the
 *  16-bit {high,low} right with a feedback bit = low bit1 XOR bit2. [seen] */
export const PRNG_LOW = 0x800d;
/** PRNG state high byte. [seen] */
export const PRNG_HIGH = 0x800e;

// ── Round / difficulty ────────────────────────────────────────────────────────
/** Current player's LEVEL / round counter — inits to 1, +1 per level cleared; every
 *  difficulty subsystem scales off it (countdowns, reloads). Proposer≠confirmer converged
 *  (both graders high-confidence): init=1 (startGame), inc (advanceToNextLevel), scaled in seedMountainErosion/initRoundAndEnterMainLoop/seedChamberCreature. [seen] */
export const LEVEL = 0x8028;

// ── Shared tile/colour column-plotter parameter block (0x8055-0x8060) ─────────
/** Run length for the shared column plotter — how many cells the copy/fill helpers
 *  (copyTileColumn/copyCappedTileColumn/fillColourColumn) paint straight down a map column (djnz count,
 *  stride 0x20 = one screen row). Staged by ~18 painter routines before each draw call.
 *  Proposer≠confirmer converged (both graders high-confidence). Sits beside TILE_COL/TILE_ROW. [seen] */
export const PLOT_RUN_LENGTH = 0x8055;

// ── Falling hazards (rock / arrow) ────────────────────────────────────────────
/** HAZARD_ACTIVE_COUNT (0x80bd) — number of falling hazards (rocks/arrows) currently live: 0 = none.
 *  The first-diamond award is gated on this being 0 (§2.8), and it bounds the drop machinery. Bumped
 *  when a hazard spawns, decremented as they retire, cleared on reset/boundary. Grounded (§2.5/§2.8). [seen] */
export const HAZARD_ACTIVE_COUNT = 0x80bd;

// ── Laser + shared reaction/laser sprite slot (0x8094-0x80a4, time-multiplexed; §2.3) ─
/** LASER_STATE (0x80a1) — laser-bolt state, laser-specific within the shared slot: 0 = ready,
 *  +8 (0x08) = flying right, 0xf8 (−8) = flying left, 1 = spent. Set on fire (input 0x8018 bit4 +
 *  horizontal PLAYER_FACING), stepped by the flight routine, cleared to 0 when fire is released so the
 *  next press re-arms — one bolt in flight at a time. Grounded (§2.3, grounding-2 Z-7). [seen] */
export const LASER_STATE = 0x80a1;

/** Per-object reaction/animation state selector: 0 = idle (normal per-frame movement runs),
 *  1-4 = a specific collision/dig/push reaction is armed + playing; also a busy-lock that
 *  defers the normal frame. Armed to 1-4 by locateObjectCellCheckGoal/collectAlignedLootElseResolveTile/resolveObjectTerrainStep/resolveActorTerrainStep/triggerDigReaction, dispatched by
 *  advancePlayerLaser, deferred by stepObjectFromControl, render-Y-biased at ==4. Proposer≠confirmer
 *  converged (both graders high-confidence). [seen] */
export const REACTION_STATE = 0x80a2;

// ── Under-tile latches (the classify ladder records these when the tracked object aligns
//    on a special tile: 0x27 -> GOAL_TILE_LATCH, 0x26 -> PRIZE_GATE) ──────────────
/** Latch set when the tracked object REACHES the special goal tile 0x27 (once past column
 *  0x53); tested nonzero to reroute state dispatch to the goal handler and enable the terrain
 *  scroll-reveal; cleared at init and on retreat (col < 0x53). Proposer≠confirmer converged on
 *  the role (proposed names MARKER/GOAL, both graders confident). [seen] */
export const GOAL_TILE_LATCH = 0x80e7;
/** Latch set when the object's under-tile == 0x26 — a DISTINCT field from GOAL_TILE_LATCH's
 *  0x27 (the shared classify ladder resolveObjectTerrainStep records both adjacently, which is why the two
 *  look twinned). Gates the 0x3b-0x3d feature path (collectLootTile) and is cleared by a boundary
 *  one-shot (stepObjectRowUnflipped/stepObjectRowFlipped, alongside HAZARD_ACTIVE_COUNT). NOT part of the 0x27 goal path.
 *  The 0x26 feature cell is the PREREQUISITE that unlocks the +20 diamond pickup
 *  (TREASURE_COLLECTED 0x8078); verified vs collectLootTile, resolveActorTerrainStep.
 *  ★ Proposer≠confirmer BOTH converged on the wrong tile (0x27); the adversarial review
 *  corrected it to 0x26 — why the third review is load-bearing even after convergence. [seen] */
export const PRIZE_GATE = 0x8076;

// ── Naming batch 2 (proposer≠confirmer, all 6 converged) ──────────────────────
/** Reaction step/animation countdown for the REACTION_STATE machine: reloaded from the period
 *  byte 0x80a3 when a reaction (1-4) is armed, decremented per frame by advancePlayerLaser, and on zero
 *  ends the reaction (clears REACTION_STATE); the value 0x18 also cues a sound. [seen] */
export const REACTION_TIMER = 0x80a4;
/** HAZARD_X (0x80a9) — X of the falling-hazard / dig-carve target cell (>>3 -> tile column); this ONE
 *  record is shared between a falling rock/arrow and the dig-carve target-capture (loc_29ad drives both).
 *  Paired with HAZARD_Y, bbox-compared against the player for capture, folded into the VRAM cell address.
 *  [seen] */
export const HAZARD_X = 0x80a9;
/** HAZARD_Y (0x80ac) — Y of the same record; when a hazard is falling it advances +1/frame (§2.5).
 *  Paired with HAZARD_X. (The X/Y label is rotation-dependent but consistently pairs.) [seen] */
export const HAZARD_Y = 0x80ac;
/** HAZARD_STATE (0x80aa) — state/phase of the falling-hazard / dig-carve object AND the sprite
 *  CODE/shape it publishes: 0x10 = falling/spawn (drawn as the down-arrow SHAPE), 0x30 = resting/carving,
 *  0x09 = done/target (§2.5). Branched on by advanceDigCarveObject and copied into the sprite record's
 *  code byte 0x8229 by stageDigObjectSpriteRecord — so THIS cell (not HAZARD_TYPE) selects the falling
 *  shape. [seen] */
export const HAZARD_STATE = 0x80aa;
/** PIT_CROSS_ACTIVE (0x8077, sticky) — the Pit-crossing flag: set when the player reaches goal tile
 *  0x27 (past column 0x53); it gates boarding the ship at the far edge (col ≥ 0x8a, loc_19d0/19e3) and
 *  disables the laser while crossing. The cross itself awards no points (§2.5, grounding-2 Z-5). [seen] */
export const PIT_CROSS_ACTIVE = 0x8077;
/** SPRITE_COORD_BIAS (0x8051) — flipBit<<1, i.e. true value **0x02** when the picture is flipped
 *  (0 in an upright cabinet): a +2 sprite-Y nudge biased into published sprite coordinates, computed
 *  once by the DSW decode applyDipSwitches. It is NOT the screen flip itself — the real 180° flip is
 *  the hardware LS259 flipscreen latch lines b6/b7 that loc_4b55 writes to 0xb006/0xb007, not this
 *  cell. [seen] */
export const SPRITE_COORD_BIAS = 0x8051;

// ── Player / board-transition control block (0x8079-0x807d) ───────────────────
// A small control block for the player the dispatcher walks each frame: a presence flag (0x8079),
// a busy-this-frame flag (0x807a), the board-end phase (BOARD_END_PHASE 0x807b), the master
// TRANSITION_TIMER (0x807c) and its POST_TRANSITION_MODE selector (0x807d) — the one gate that
// routes every life-loss and every level-advance (§2.9). dispatchObjectFrameByStateTimer/advanceTrackedObject
// walk them as the head guards of the per-frame dispatcher.

/** Presence flag for the tracked object (the one PLAYER_Y/PLAYER_X locate): 0 = no live object
 *  (skip its per-frame work), 0xff = present. Set 0xff when the object is first seeded
 *  (advanceTwoSpriteActor, alongside its PLAYER_Y tile), cleared when it exits at a boundary (advanceAltPhaseActor,
 *  together with PLAYER_Y); read as the "nothing active, done" guard by the object/state
 *  dispatcher (advanceTrackedObject) and as the "nothing to classify" gate by steerDemoPlayer. Consistent
 *  0/0xff presence role across 6 routines. [seen] */
export const PLAYER_ACTIVE = 0x8079;

/** TRANSITION_TIMER (0x807c) — the MASTER board-transition countdown (§2.9). Each frame the player
 *  dispatcher (loc_13c9) decrements it and defers normal processing while it runs; on expiry it reads
 *  POST_TRANSITION_MODE 0x807d and vectors to EITHER lose-a-life OR advance-a-level. Armed to a duration
 *  at events (0x78 idle-arm; 0xb4 on reboard/boundary latch). Grounded directly (§2.9, tape_transition:
 *  0x807c 8→0 drove level 1→2 with mode=1, or lives 3→2 with mode=0). [seen] */
export const TRANSITION_TIMER = 0x807c;

/** POST_TRANSITION_MODE (0x807d) — the death-vs-advance selector read when TRANSITION_TIMER expires:
 *  0 → lose a life (loc_0278, MEN_LEFT--); 1 → advance a level (loc_02fd, LEVEL++ + board-complete bonus).
 *  Set to 1 by the escape/reboard actors (ship-landing loc_384a, pit-cross reboard), left/forced 0 by the
 *  enemy-catch and bare-timer paths. Grounded (§2.9). [seen] */
export const POST_TRANSITION_MODE = 0x807d;

// ── Named by the adversarial RAM-naming pass: proposer≠confirmer + an independent judge,
//    by cross-routine consensus, keep-hex-if-ungrounded. Unlike the older names above,
//    these DID get the adversarial re-derivation (and, 2026-07-31, a proposer≠confirmer
//    re-grade). Each cell below carries its own [seen]/[code]/[guess] evidence tag; the
//    pixel gate stays the correctness authority, not the name.

// ── Score (packed-BCD) + high-score display staging ──
/**
 *  SCORE_LO (0x8031) — Low packed-BCD byte of the active player's 2-byte score; BCD-added by
 *  awardTwentyPoints/addScore, split to digits by drawScoreDigits, read as hiscore candidate by insertHighScore, cleared
 *  by resetScoreAndSoundQueue -- four independent users. [seen]
 */
export const SCORE_LO = 0x8031;
/**
 *  SCORE_HI (0x8034) — High packed-BCD byte of the active score paired with 0x8031, same four
 *  routines (addScore carry target, drawScoreDigits render with leading-zero blank, insertHighScore
 *  candidate, resetScoreAndSoundQueue clear). [seen]
 */
export const SCORE_HI = 0x8034;
/**
 *  SCORE_DISPLAY_LOW (0x8037) — Low byte of the 16-bit score value staged by renderScoreReadouts per
 *  high-score record and unpacked into digit tiles by unpackScoreDigits/unpackScoreDigits. [seen]
 */
export const SCORE_DISPLAY_LOW = 0x8037;
/**
 *  SCORE_DISPLAY_HIGH (0x8038) — High byte of the 16-bit score value staged at 0x8037 for the
 *  digit unpacker; written by renderScoreReadouts, read MSB-first by unpackScoreDigits. [seen]
 */
export const SCORE_DISPLAY_HIGH = 0x8038;

// ── Tilemap write geometry + wait/glitter/step timers ──
/**
 *  FRAME_WAIT_COUNTDOWN (0x8009) — Per-frame countdown decremented each frame by the vblank
 *  NMI (serviceVblankNmi ld/dec/ld) and armed+busy-waited to 0 by waitFrames/waitFrames; both namers
 *  and my derivation agree, grounded in two independent routines. [seen]
 */
export const FRAME_WAIT_COUNTDOWN = 0x8009;
/**
 *  STEP_TIMER_BASE (0x804f) — DSW-decoded base (applyDipSwitches) that seeds the step timer 0x8067 =
 *  0x804f - 4*LEVEL (seedMountainErosion); 0x8067 is the per-step countdown erodeMountain decrements each
 *  frame. [seen]
 */
export const STEP_TIMER_BASE = 0x804f;
/**
 *  TILEMAP_OFFSET (0x805a) — 16-bit tilemap offset 32*row+col computed by rowColToTileOffset from
 *  0x8059/0x8058 and consumed by deriveTileWriteCursors to derive colour/video cursors; shared across ~10
 *  painter routines, both converged. [seen]
 */
export const TILEMAP_OFFSET = 0x805a;
/**
 *  GLITTER_COUNTDOWN (0x805c) — Free-running 8->1 (reload 8) per-frame countdown that
 *  glitterJewels uses to pace the diamond-glitter cell recolour, armed to 1 by
 *  paintScreen/paintScreen; role behaviorally pinned, both converged. [seen]
 */
export const GLITTER_COUNTDOWN = 0x805c;
/**
 *  COLOUR_RAM_CURSOR (0x805e) — 16-bit colour-RAM write cursor = tilemap offset + 0x8800
 *  colour base, stored by deriveTileWriteCursors (paired with the 0x8060 video cursor) and walked down-
 *  column by the fillers fillColourColumn/cyclePanelColumnColour/etc across ~10 routines. [seen]
 */
export const COLOUR_RAM_CURSOR = 0x805e;
/** VIDEO_RAM_CURSOR (0x8060) — 16-bit video-RAM write cursor = VIDEO_RAM_BASE + tilemap offset, the pair of COLOUR_RAM_CURSOR; staged by deriveTileWriteCursors and walked down-column by copyTileColumn/copyCappedTileColumn. [seen] */
export const VIDEO_RAM_CURSOR = 0x8060;
/** VIDEO_RAM_BASE (0x9000) — base of the 32x32 tilemap (character map) the display reads; tilemap cells hang off it as VIDEO_RAM_BASE + row*32 + col. [seen] */
export const VIDEO_RAM_BASE = 0x9000;
/** COLOUR_RAM_BASE (0x8800) — base of the per-tile colour map paired with the tilemap. [seen] */
export const COLOUR_RAM_BASE = 0x8800;
/**
 *  MOUNTAIN_ERODE_PTR (0x8065) — 16-bit VRAM write cursor for the mountain erosion (§2.6): seeded
 *  0x9104 by seedMountainErosion, deref'd via IX and walked +0x20/step down the mountain column (writing
 *  tile 0x31) by erodeMountain as the mountain visibly eats away. Grounded (§2.6). [seen] */
export const MOUNTAIN_ERODE_PTR = 0x8065;
/**
 *  MOUNTAIN_ERODE_TIMER (0x8067) — per-step countdown pacing the erosion: armed level-scaled
 *  (diffBase 0x804f − 4*LEVEL, so erosion runs faster every level) by seedMountainErosion, decremented each
 *  frame by erodeMountain which advances one step only on expiry. Grounded (§2.6). [seen] */
export const MOUNTAIN_ERODE_TIMER = 0x8067;

// ── Tracked-object tile cell + sprite attribute ──
/**
 *  PLAYER_SPRITE_ATTR (0x806a) — object sprite attribute byte (palette bits0-2 + priority bit3):
 *  seeded 2 by seedObjectStartState, copied by stageObjectSpriteRecord into sprite-record byte+2 (0x8222) which video.js
 *  decodes as color and priority [seen]
 */
export const PLAYER_SPRITE_ATTR = 0x806a;
/**
 *  PLAYER_TILE_COL (0x8071) — tilemap COLUMN cell under the tracked object, derived from
 *  position counter 0x806b (>>3), written by resolveObjectTile/stepObjectAndResolveTile/locateObjectCellCheckGoal/locateActorCellCheckGoal and seeded 5; the low
 *  part of the 0x806e VRAM cell pointer [seen]
 */
export const PLAYER_TILE_COL = 0x8071;
/**
 *  PLAYER_TILE_ROW (0x8073) — tilemap ROW cell under the tracked object, derived from counter
 *  0x8068 (0x1f-((x+bias)>>3)), written by resolveObjectTile/stepObjectAndResolveTile/stepObjectRowUnflipped/stepObjectRowFlipped and seeded 0x19; the *0x20
 *  major part of the 0x806e VRAM cell pointer [seen]
 */
export const PLAYER_TILE_ROW = 0x8073;

// ── Probe-cell walk + sub-tile phase + mover dispatch state ──
/**
 *  PROBE_CELL_PTR (0x8089) — 16-bit VRAM/tilemap cell pointer (base 0x9000) written in
 *  stepEnemyMover/loc_3289 and dereferenced+stepped ±0x20/row by the tile-probe helpers
 *  tileInProbeRow/probeRowBackTilePair/nextTileInProbeRow/probeRowAheadTilePair; A, B and my derivation all agree, grounded across writer + four
 *  readers. [seen]
 */
export const PROBE_CELL_PTR = 0x8089;
/**
 *  SUBTILE_PHASE (0x808d) — Sub-tile phase / probe-table row index derived from the pixel
 *  position in loc_3289 and loaded as the DE row selector (D=0) by all four probe helpers
 *  (0x34fe/0x35fe ±0x20 rows); both namers and my derivation converge, grounded across five
 *  routines. [seen]
 */
export const SUBTILE_PHASE = 0x808d;
/**
 *  ENEMY_WORK_STATE (0x8090) — signed state byte of the enemy in the 0x8083 work slot: stepEnemyMover
 *  dispatches on its sign (neg->advanceDormantMover dormant tick, zero->arm 0x808b countdown,
 *  positive->player-box branch) and advanceDormantMover bumps it each call. Also the LASER-KILL death
 *  marker: a shot enemy is parked at 0xc0 and free-run to respawn (§2.3/§2.4, grounded). [seen]
 */
export const ENEMY_WORK_STATE = 0x8090;

// ── Reaction object (position paired with the player box) ──
/**
 *  REACTION_OBJ_X (0x8094) — PLAYER_Y-paired position coordinate of the REACTION_STATE (0x80a2)
 *  entity: written each frame by advancePlayerLaser from PLAYER_Y±8, player-box-tested in stepEnemyMover, placed
 *  by spawnDigEntity, written to sprite record byte 0, inited 0 by resetReactionState; both converge, well
 *  grounded. [seen]
 */
export const REACTION_OBJ_X = 0x8094;
/**
 *  REACTION_OBJ_Y (0x8097) — PLAYER_X-paired position coordinate of the REACTION_STATE (0x80a2)
 *  entity: written by advancePlayerLaser from PLAYER_X±8, player-box-tested in stepEnemyMover against the 0x8086
 *  axis, written to sprite record byte 3, inited 0 by resetReactionState; both converge, well grounded.
 *  [seen]
 */
export const REACTION_OBJ_Y = 0x8097;

// ── Falling-hazard / dig object record (type / timer / subtype / arm-state) ──
/**
 *  HAZARD_TYPE (0x80ab) — falling-hazard COLOUR, not its glyph: the sprite palette select **0x06 rock /
 *  0x07 arrow** (§2.5, grounded). stageDigObjectSpriteRecord copies it into the hazard sprite record's
 *  attribute/COLOUR byte 0x822a, whose low 3 bits pick the palette (palette 6 rock / 7 arrow, confirmed
 *  vs boards/thepit/video.js). Rock and arrow are the SAME object drawn as the SAME down-arrow SHAPE —
 *  the shape comes from HAZARD_STATE's code, not from here — in a different COLOUR. The resting/seed
 *  value is 0x07 (arrow), flipped to 0x06 (rock) when a dig disturbs the drop queue. [seen] */
export const HAZARD_TYPE = 0x80ab;
/**
 *  DIG_OBJ_TIMER (0x80b1) — countdown/animation timer for the dig-carve object, armed to
 *  0x08/0x10/0x40 or reloaded from 0x80c2, decremented per frame and acted on at expiry across 7 routines
 *  (captureTargetOnOverlap/advanceDigCarveObject/triggerDigReaction/spawnPendingDigObject/spawnDigEntity/commitDigEntity/seedDigObjectBlock).
 *  ★ Shared: this same byte is the falling-hazard LIFETIME (§2.5). [seen] */
export const DIG_OBJ_TIMER = 0x80b1;
/**
 *  DIG_OBJ_SUBTYPE (0x80c0) — sub-type/variant selector of the committed dig entity, written
 *  by spawnDigEntity and dispatched by loc_298a and advanceDigCarveObject (0=plain/ret, 2=special: arm timer +
 *  patch neighbour tiles to 0xc1); grounded across 4 routines, A/B converged [seen]
 */
export const DIG_OBJ_SUBTYPE = 0x80c0;
/**
 *  DIG_COLLISION_STATE (0x80c1) — arm/capture state of the carve object
 *  (0=idle,1=armed/captured,2=latched): gates advanceTrackedObject dispatch, set by capture captureTargetOnOverlap and
 *  arm triggerDigReaction, cleared with the block by seedDigObjectBlock; grounded across 7 routines, role
 *  converged (name prefix normalised to the DIG_OBJ family) [seen]
 */
export const DIG_COLLISION_STATE = 0x80c1;

// ── The left-chamber creature (live slot-3 sprite, §2.8) ──
/**
 *  CHAMBER_CREATURE_X (0x80db) — the left-chamber creature's X (byte0): a horizontal bounce in
 *  [0x19,0x38) (velocity 0x80df) init 0x28 by seedChamberCreature, published as byte0 of the slot-3
 *  record 0x822c; matches the ENEMY3_X byte convention. Grounded (§2.8). [seen] */
export const CHAMBER_CREATURE_X = 0x80db;
/**
 *  CHAMBER_CREATURE_FRAME (0x80dc) — creature sprite tile/frame code toggled 0x38<->0x39 every 8 frames
 *  (advanceChamberCreature/advanceChamberCreatureAnimation/setChamberCreatureFrame), init 0x39, published as the code byte of the slot-3
 *  record. Grounded (§2.8). [seen] */
export const CHAMBER_CREATURE_FRAME = 0x80dc;
/**
 *  CHAMBER_CREATURE_ATTR (0x80dd) — byte2 attribute (color low bits + priority) of the creature sprite; bumped by
 *  advanceChamberCreature with `and 0xf7` holding priority bit3 clear while cycling color, init 0xc0;
 *  role converged (normalised to ATTR per video.js decode) [seen] */
export const CHAMBER_CREATURE_ATTR = 0x80dd;
/**
 *  CHAMBER_CREATURE_FALL_Y (0x80de) — Y (byte3) of the creature: its OWN accelerating vertical fall
 *  (step 0x80e0) clamped at 0x86 then RNG-reseeded by advanceChamberCreature (the creature repeatedly
 *  drops and resets, §2.8) — there is NO separate "shell". Init 0x78, published as byte3 of the
 *  slot-3 record. Grounded (§2.8). [seen] */
export const CHAMBER_CREATURE_FALL_Y = 0x80de;

// ── Creature frame-clock phase + Pit sliding-floor reveal (period / gate / cursor), §2.8 ──
/**
 *  CHAMBER_CREATURE_ANIM_PHASE (0x80e3) — Down-counter mod 8: decremented per frame, reloads 8 on wrap
 *  and toggles sprite frame 0x80dc, low bits gate the position-step; read by advanceChamberCreatureAnimation and
 *  advanceChamberCreature, seeded 1 by seedChamberCreature — A and B agree, derivation confirms. [seen]
 */
export const CHAMBER_CREATURE_ANIM_PHASE = 0x80e3;
/**
 *  PIT_FLOOR_REVEAL_PERIOD (0x80e4) — Level-derived reload period (7..3 via A^=0x07 from 0x8028) for
 *  the Pit sliding-floor reveal gate 0x80e5; written by seedChamberCreature, consumed by revealTerrainColumn/advanceChamberCreature on gate wrap —
 *  both namers converge, derivation confirms. [seen]
 */
export const PIT_FLOOR_REVEAL_PERIOD = 0x80e4;
/**
 *  PIT_FLOOR_REVEAL_GATE (0x80e5) — Per-column frame-gate down-counter for the Pit sliding-floor reveal:
 *  decremented each call, on wrap reloads from PIT_FLOOR_REVEAL_PERIOD 0x80e4 and reveals one floor
 *  column; revealTerrainColumn/advanceChamberCreature, seeded 1 by seedChamberCreature — grounded and convergent. [seen]
 */
export const PIT_FLOOR_REVEAL_GATE = 0x80e5;
/**
 *  PIT_FLOOR_REVEAL_CURSOR (0x80e6) — Byte offset into tile-pattern table 0x3048, stepped back 6 per
 *  reveal (underflow ends reveal), seeded 0x96 by seedChamberCreature; advanced by revealTerrainColumn/advanceChamberCreature and
 *  independently tested ==0 by dispatcher advanceTrackedObject as the reveal-finished gate. [seen]
 */
export const PIT_FLOOR_REVEAL_CURSOR = 0x80e6;

// ── Object 1 record + Object 2 record ──
/**
 *  ENEMY1_X (0x80e8) — Base (offset 0) of the first object record: seeded/reset 0xec
 *  (seedEnemyRecords/stepEnemyMover), copied to sprite record 0x8230 byte 0 by updateEnemy1 — the SAME structural
 *  field as ENEMY2_X (0x80f9), so X by the house convention (offset 0 = X, ENEMY3_X/PLAYER_Y). Under
 *  ROT90 the sprite's hardware-Y byte is the on-screen horizontal, which the codebase calls X.
 *  (The record's Y is the offset-3 byte ENEMY1_Y 0x80eb.) [seen]
 */
export const ENEMY1_X = 0x80e8;
/**
 *  ENEMY1_SPRITE (0x80e9) — Object-1 record byte1: seeded 0x09 by seedEnemyRecords, copied to
 *  sprite byte 0x8231 by updateEnemy1; video.js decodes it as code&0x3f + flipX(0x40) +
 *  flipY(0x80) — sprite code+orientation confirmed. [seen]
 */
export const ENEMY1_SPRITE = 0x80e9;
/**
 *  ENEMY1_ATTR (0x80ea) — Object-1 record offset 2: seeded 0x04 (seedEnemyRecords), copied verbatim to
 *  sprite-record byte 2 (updateEnemy1), color-cycled with priority bit 3 held clear (advanceDormantMover) --
 *  A/B and my derivation all agree. [seen]
 */
export const ENEMY1_ATTR = 0x80ea;
/**
 *  ENEMY1_MOVE_PERIOD (0x80f6) — Object-1 record offset 14: seedEnemyRecords derives 7-(LEVEL&6)
 *  (faster as level climbs) and loc_3490 reloads the offset-8 cadence timer from it -- A/B
 *  converge (reload/period) and my derivation agrees, grounded across two routines. [seen]
 */
export const ENEMY1_MOVE_PERIOD = 0x80f6;
/**
 *  ENEMY1_TARGET_COL (0x80f8) — Object-1 record offset 16 target column: seeded 0x04
 *  (seedEnemyRecords); stepEnemyMover fast-exits when 0x807a equals it and keys the tile-probe/direction
 *  dispatch on it -- A/B and my derivation agree. [seen]
 */
export const ENEMY1_TARGET_COL = 0x80f8;
/**
 *  ENEMY2_X (0x80f9) — Base (offset 0) of the second 17-byte object record: staged/emitted as
 *  sprite byte 0 by updateEnemy2, position-tested in stepEnemyMover, seeded 0x00; matches house
 *  convention ENEMY3_X=offset 0 -- A/B agree. [seen]
 */
export const ENEMY2_X = 0x80f9;
/**
 *  ENEMY2_SPRITE (0x80fa) — Object-2 record offset 1 sprite tile/code byte: seeded 0x09, emitted
 *  verbatim to sprite byte 1 (updateEnemy2), rewritten with the direction/orientation code
 *  (stepEnemyMover/stepMoverUp); matches house convention ENEMY3_TILE=offset 1 -- A/B agree. [seen]
 */
export const ENEMY2_SPRITE = 0x80fa;
/**
 *  ENEMY2_ATTR (0x80fb) — Object-2 record offset 2 attr/color byte: seeded 0x04, emitted to
 *  sprite byte 2, color-cycled with priority bit 3 held clear by advanceDormantMover -- same field as
 *  ENEMY1_ATTR; A/B and my derivation agree. [seen]
 */
export const ENEMY2_ATTR = 0x80fb;

// ── Actor per-frame step + twin timer + saved cell pointer ──
/**
 *  ENEMY3_STEP_X (0x810e) — Low byte of the actor 16-bit step vector: advanceTwoSpriteActor loads it into L
 *  and adds it to ENEMY3_X (0x810a) each cadence tick; seeded 0xff(-1)/0 by
 *  seedActorSpawnState/3767/advanceOrRebuildTwinActor. Real reader, A and B agree, my derivation confirms. [seen]
 */
export const ENEMY3_STEP_X = 0x810e;
/**
 *  ENEMY3_STEP_Y (0x810f) — High byte of the actor step vector: advanceTwoSpriteActor loads it into H and
 *  adds it to ENEMY3_Y (0x810d) each cadence tick; seeded alongside 0x810e. Real reader, A and
 *  B agree, my derivation confirms. [seen]
 */
export const ENEMY3_STEP_Y = 0x810f;
/**
 *  ENEMY3_TWIN_TIMER (0x8123) — Both namers converged and my derivation agrees: twin of
 *  ENEMY3_TIMER(0x8112); record+8 -> scratch 0x808b, decremented/reloaded as the cadence
 *  countdown by stepEnemyMover (0x31b1) and armed (0xb4/0x01) by the spawn seeders. Grounded across
 *  seeders + stepEnemyMover; primary ENEMY3_TIMER already named, so pairing is consistent. [seen]
 */
export const ENEMY3_TWIN_TIMER = 0x8123;
/**
 *  SAVED_CELL_PTR (0x8134) — Both namers converged and my derivation agrees: a 16-bit scratch
 *  slot holding a tilemap cell pointer. probeRowBackTilePair and probeRowAheadTilePair each do 'ld (0x8134),hl' (save
 *  advanced/one-row-back cursor) then 'ld ix,(0x8134)' a few instructions later. Grounded
 *  across two neighbour-search routines as a within-search save/restore. [seen]
 */
export const SAVED_CELL_PTR = 0x8134;

// ── Clarify pass 2026-07-27 (proposer≠confirmer + judge; the loot/dig/sprite subsystems
//    that the batch-3/4/5 decompiles made legible). Each cell carries its own tag. ─────

// ── Loot pickup counters + high-score table ──
/**
 *  CRYSTAL_COUNT (0x8081) — count of crystals collected (tile 0x3a): the collect path awards
 *  bc=0x0010 BCD (**displayed +1000** — all score is shown ×100, §2.8) then increments it; seeded 0,
 *  read by the board-complete bonus as a threshold (==4). Grounded (§2.8, grounding-2 Z-3). [seen] */
export const CRYSTAL_COUNT = 0x8081;
/**
 *  DIAMOND_COUNT (0x8082) — count of diamonds collected (tiles 0x3b/0x3c/0x3d): the collect path
 *  awards bc=0x0020 BCD (**displayed +2000**, gated by PRIZE_GATE + the TREASURE_COLLECTED one-shot)
 *  then increments it; seeded 0, read by the board-complete bonus as a threshold (==3). Grounded
 *  (§2.8). [seen] */
export const DIAMOND_COUNT = 0x8082;
/**
 *  TREASURE_COLLECTED (0x8078) — set nonzero on a +20 diamond pickup (loot tiles 59-61, gated by the
 *  0x26 feature cell); read at the top rung (PLAYER_X==0x23, object surfacing UP) where it flips
 *  BOARD_END_PHASE=1 = level complete (observed A/B). Precise to the diamond: the +10 dirt-gems (tile 58)
 *  do NOT set it. Grounded across the loot routines (collectLootTile, stepObjectAndResolveTile,
 *  resolveActorTerrainStep, collectAlignedLootElseResolveTile, seedObjectStartState-family).
 *  ★ HONEST CAVEAT — the SAME physical byte is also read by the dig driver (advanceDigCarveObject, as a dig-spawn
 *  condition), read by the twin-actor advance (advanceActorMovers, as its second-record gate), and
 *  cleared by the dig glyph-stamp (stampGlyphColumn). Whether those are true couplings or byte-reuse
 *  is UNPROVEN — do not assert a coupling. [seen]
 */
export const TREASURE_COLLECTED = 0x8078;
/**
 *  HIGH_SCORE_TABLE (0x8039) — Base/top rank of the descending three-entry high-score table
 *  (5-byte records: 3 initials + 16-bit score at 0x8039/0x803e/0x8043); seeded by initScoreDisplay,
 *  rendered by renderScoreReadouts, ranked-inserted with 0xFF initials placeholders by insertHighScore, blitted
 *  by runHighScoreInitialsEntry. [seen]
 */
export const HIGH_SCORE_TABLE = 0x8039;
/** HIGH_SCORE_RANK2_ENTRY (0x803e) — second-rank record of the descending 3-entry high-score table
 *  (HIGH_SCORE_TABLE + 5); 5-byte record = 3 initials + 16-bit score; this is the record's first byte. [seen] */
export const HIGH_SCORE_RANK2_ENTRY = 0x803e;
/** HIGH_SCORE_RANK3_ENTRY (0x8043) — third-rank record of the high-score table (HIGH_SCORE_TABLE + 10);
 *  5-byte record = 3 initials + 16-bit score; record's first byte. [seen] */
export const HIGH_SCORE_RANK3_ENTRY = 0x8043;

// ── Object phase/step + mover direction ──
/**
 *  PLAYER_ANIM_PHASE (0x801a) — Tracked object's packed animation/command phase byte (high bits
 *  wind-up countdown stepped -0x20, low bits &0x0c = move command vs L); seeded 0 by
 *  seedObjectStartState, reconciled each frame by windUpObjectMove, zeroed on the idle path by routeIdleObjectByMoveCommand. [seen]
 */
export const PLAYER_ANIM_PHASE = 0x801a;
/**
 *  PLAYER_STEP_Y (0x806c) — the player's per-frame Y step: added to the committed PLAYER_Y (0x8068)
 *  by walkActor, subtracted from it by advanceObjectWalkFrame, low byte of the DE step-vector in
 *  advanceTrackedObject, seeded 1 by seedObjectStartState. [seen]
 */
export const PLAYER_STEP_Y = 0x806c;
/**
 *  PLAYER_STEP_X (0x806d) — the player's per-frame X step: added to the committed PLAYER_X (0x806b)
 *  by advanceActorWalk, subtracted by stepObjectAndResolveTile, high byte of the DE step-vector in
 *  advanceTrackedObject, seeded 1 by seedObjectStartState. [seen]
 */
export const PLAYER_STEP_X = 0x806d;
/**
 *  ENEMY_WORK_DIR (0x8092) — Published travel-direction index: stamped 0/1/2/3 by the four
 *  direction presets (stepMoverUp/stepMoverMirrored/stepMoverDown/stepMoverUnmirrored) at 0x34a0, consumed by stepEnemyMover's dec-a/jp-z
 *  direction fan-out at 0x32ce and 0x3345; A and B and my derivation all converge. [seen]
 */
export const ENEMY_WORK_DIR = 0x8092;

// ── Dig-entity staging (spawnDigEntity -> commitDigEntity hand-off) + expected tile ──
/**
 *  EXPECTED_TILE (0x80a7) — The object cell's table-resolved expected tile: seeded from the
 *  raw under-tile then overwritten with the ROM lookup, cross-checked vs CUR_TILE 0x80a5 in
 *  loc_164f to detect a change, and stamped into (ix+0) by advancePlayerLaser; both namers converged
 *  high-confidence, real readers + writers. [seen]
 */
export const EXPECTED_TILE = 0x80a7;
/**
 *  STAGED_TARGET_X (0x80b6) — Staged X coord = REACTION_OBJ_X-4 written by spawnDigEntity, promoted
 *  into HAZARD_X 0x80a9 by commitDigEntity and X-axis bbox-tested vs PLAYER_Y 0x8068 by advanceDigCarveObject; both
 *  namers converged, grounded across all three. [seen]
 */
export const STAGED_TARGET_X = 0x80b6;
/**
 *  STAGED_TARGET_Y (0x80b9) — Staged Y coord (PLAYER_X grid-snapped and lifted) written by
 *  spawnDigEntity, promoted into HAZARD_Y 0x80ac by commitDigEntity and Y-axis bbox-tested vs PLAYER_X 0x806b
 *  by advanceDigCarveObject; both namers converged, grounded across all three. [seen]
 */
export const STAGED_TARGET_Y = 0x80b9;
/**
 *  STAGED_CELL_PTR (0x80ba) — 16-bit copy of PLAYER_CELL_PTR 0x806e saved by spawnDigEntity and
 *  reloaded into the live carve cursor 0x80af by commitDigEntity; both namers converged and
 *  SAVED_CELL_PTR is already taken by 0x8134 in names.js, so STAGED_CELL_PTR is the correct
 *  distinct name. [seen]
 */
export const STAGED_CELL_PTR = 0x80ba;
/**
 *  STAGED_DIG_TIMER (0x80bc) — spawnDigEntity writes REACTION_PERIOD<<1 here; commitDigEntity promotes it
 *  verbatim into the named DIG_OBJ_TIMER (0x80b1) -- a clean single writer/reader staging
 *  cell for the dig timer, A+B converged. [seen]
 */
export const STAGED_DIG_TIMER = 0x80bc;
/**
 *  STAGED_DIG_SPRITE_ID (0x80bf) — spawnDigEntity stages the classified dig-entity id here;
 *  commitDigEntity stamps it into the tilemap cell before the carve cursor (mem[cellPtr-1]) -- clean
 *  writer/reader pair, A+B converged. [seen]
 */
export const STAGED_DIG_SPRITE_ID = 0x80bf;

// ── Sprite record attributes + staging buffer base + loop counter ──
/**
 *  ENEMY3_ATTR (0x810c) — Byte+2 of the primary sprite record 0x810a: stageActorSpriteRecords copies it to
 *  sprite-RAM byte2 (0x823a), which video.js decodes as color(bits0-2)+priority(bit3); seeded
 *  by all four spawners. Grounded, A+B converged. [seen]
 */
export const ENEMY3_ATTR = 0x810c;
/**
 *  ENEMY3_TWIN_ATTR (0x811d) — Byte+2 of the twin record 0x811b; stageActorSpriteRecords copies it to sprite-RAM
 *  byte2 (0x823e), decoded as color+priority by video.js -- mirror of ENEMY3_ATTR, same
 *  seeders. Grounded, A+B converged. [seen]
 */
export const ENEMY3_TWIN_ATTR = 0x811d;
/**
 *  SPRITE_STAGING_BASE (0x8220) — Base of the 32-byte (8x4) sprite-record staging buffer the
 *  NMI serviceVblankNmi LDIRs to hardware sprite RAM 0x9840 each frame; filled by
 *  stageObjectSpriteRecord/stageActorSpriteRecords, wiped by clearSpriteStagingBuffer.
 *  Grounded, A+B converged. [seen]
 */
export const SPRITE_STAGING_BASE = 0x8220;
/** OBJECT_SPRITE_ATTR (0x8222) — slot-0 sprite-staging attribute byte (SPRITE_STAGING_BASE+2) for the
 *  tracked/player object: palette bits0-2 + priority bit3, copied from PLAYER_SPRITE_ATTR. [seen] */
export const OBJECT_SPRITE_ATTR = 0x8222;
/** HAZARD_SPRITE_CODE (0x8229) — slot-2 (dig/hazard) sprite-staging record byte +1: the sprite CODE
 *  selecting the drawn shape of the falling-hazard / dig object, copied from HAZARD_STATE. [seen] */
export const HAZARD_SPRITE_CODE = 0x8229;
/** HAZARD_SPRITE_ATTR (0x822a) — slot-2 (dig/hazard) sprite-staging record byte +2: low 3 bits pick the
 *  palette (6=rock, 7=arrow), copied from HAZARD_TYPE. [seen] */
export const HAZARD_SPRITE_ATTR = 0x822a;
/** OBJ1_SPRITE_X (0x8230) — object-1 sprite-staging record byte 0 (SPRITE_STAGING_BASE+16, slot 4): staged X,
 *  copied each frame from ENEMY1_X by updateEnemy1, then LDIR'd to sprite RAM by the NMI. [seen] */
export const OBJ1_SPRITE_X = 0x8230;
/** OBJ1_SPRITE_CODE (0x8231) — object-1 sprite-staging record byte 1 (slot 4 +1): sprite code + orientation,
 *  copied from ENEMY1_SPRITE by updateEnemy1. [seen] */
export const OBJ1_SPRITE_CODE = 0x8231;
/**
 *  LOOP_COUNTER (0x800a) — Memory-resident down-counter seeded to an iteration count then
 *  decremented to 0 to repeat a loop body; grounded identically across setup-repeat
 *  setUpRoundAndHoldIntro/holdRoundIntroLoop, screen-hold showSetupScreen, and animation-tier showBonusScreen. [seen]
 */
export const LOOP_COUNTER = 0x800a;

// ═══ NAMING PASS 2026-07-27 (full-decompile: credit/coin/mode + object/mover records) ═══════
// proposer≠confirmer over the whole 169-routine layer; write-only/dead/mixed-role cells left hex.
// The 2026-07-31 centralization pass revisited the still-hex set: the player-record backups are now
// NAMED (PLAYER1_LEVEL_BACKUP/PLAYER1_MEN_BACKUP/PLAYER2_MEN_BACKUP — the [working,P1,P2] record is
// fully pinned by save/load and the backups are read at round boundaries). The write-only / dead /
// undetermined cells below now carry a loc_<addr> PLACEHOLDER const (allowlisted in names-debt.txt) so
// the idiomatic layer references them by symbol without inventing a role — each has no reader / no earned
// name. Promote to a descriptive name only if a consumer is ever found.
/** SECONDS_DOWN_COUNTER (0x800f) — write-only once-per-second down-counter (SECONDS_PRESCALER rollover decrements it);
 *  no consumer reads it; vestigial. [seen] (placeholder; names-debt) */
export const SECONDS_DOWN_COUNTER = 0x800f;
/** GAME_MODE_SHADOW_A (0x801d) — write-only shadow of the coin-slot id, written alongside GAME_STATE and GAME_MODE_SHADOW_B
 *  by bankCreditAndStart; never read. [seen] (placeholder; names-debt) */
export const GAME_MODE_SHADOW_A = 0x801d;
/** GAME_MODE_SHADOW_B (0x812d) — write-only shadow of the coin-slot id, written alongside GAME_STATE and GAME_MODE_SHADOW_A
 *  by bankCreditAndStart; never read. [seen] (placeholder; names-debt) */
export const GAME_MODE_SHADOW_B = 0x812d;
/** COCKTAIL_FLIP_INVERT_SHADOW (0x8050) — write-only shadow of the decoded cocktail flip-invert DIP bit (dsw&0x10); flip
 *  decode uses a local, not this cell. [seen] (placeholder; names-debt) */
export const COCKTAIL_FLIP_INVERT_SHADOW = 0x8050;
/** COCKTAIL_FLIP_FOLLOWS_PLAYER_SHADOW (0x8052) — write-only shadow of the decoded cocktail flip-follows-player DIP bit (dsw&0x20);
 *  never read. [seen] (placeholder; names-debt) */
export const COCKTAIL_FLIP_FOLLOWS_PLAYER_SHADOW = 0x8052;
/** OBJECT_START_STATE_SEED (0x8070) — write-only byte in the object start-state seed block, stamped to 1 at round
 *  (re)init; no reader, role undetermined. [guess] (placeholder; names-debt) */
export const OBJECT_START_STATE_SEED = 0x8070;
/** REACTION_RESET_COMPANION_SEED (0x809c) — write-only byte set to 1 in the round-start reaction-state reset; no reader, role
 *  undetermined. [guess] (placeholder; names-debt) */
export const REACTION_RESET_COMPANION_SEED = 0x809c;
/** STAGED_TARGET_X_MIRROR (0x80be) — write-only mirror of the staged dig-target column (STAGED_TARGET_X), written by
 *  commitDigEntity; never read. [seen] (placeholder; names-debt) */
export const STAGED_TARGET_X_MIRROR = 0x80be;
/** WORK_RAM_TOP_BOUNDARY (0x87ff) — highest byte of the 0x8000-0x87FF work-RAM window, directly below colour RAM
 *  (0x8800); unused boundary cell (no reads/writes). [guess] (placeholder; names-debt) */
export const WORK_RAM_TOP_BOUNDARY = 0x87ff;

/** CREDIT_COUNT (0x8000) — the credit counter: banked from the coin lines (clamp 9), spent on start;
 *  the corruption-watchdog anchor (serviceVblankNmi cold-boots if the mirrors disagree); rearmMachineAndBranchOnCredits
 *  tests it >0 to show the credit screen. [seen] */
export const CREDIT_COUNT = 0x8000;
/** CREDIT_MIRROR_A (0x801c) — redundant copy of CREDIT_COUNT, read by the corruption watchdog. [seen] */
export const CREDIT_MIRROR_A = 0x801c;
/** CREDIT_MIRROR_B (0x812c) — third redundant copy of CREDIT_COUNT, also watchdog-read. [seen] */
export const CREDIT_MIRROR_B = 0x812c;
/** COIN_SW_ACCUM (0x8003) — coin switch (IN1 bit0) edge-detect accumulator (0x55/0xaa); a completed
 *  pulse banks a credit. [seen] */
export const COIN_SW_ACCUM = 0x8003;
/** START1_SW_ACCUM (0x8004) — 1P-start switch (IN1 bit2) edge accumulator; a completed pulse pays a
 *  credit and starts a 1-player game. [seen] */
export const START1_SW_ACCUM = 0x8004;
/** START2_SW_ACCUM (0x8005) — 2P-start switch (IN1 bit1) edge accumulator; starts a 2-player game. [seen] */
export const START2_SW_ACCUM = 0x8005;
/** FRAME_COUNTER_PRESCALER (0x8007) — /60 down-divider; on rollover reloads 60 and ticks PLAY_PHASE_COUNTER. [seen] */
export const FRAME_COUNTER_PRESCALER = 0x8007;
/** MAIN_LOOP_DELAY (0x8011) — per-frame busy-wait length mainLoop burns; seeded = LOOP_DELAY_BASE − LEVEL
 *  (higher level → faster). [seen] */
export const MAIN_LOOP_DELAY = 0x8011;
/** SOUND_TAIL (0x801f) — sound-command ring READ/dequeue index (mod 8); pairs with SOUND_HEAD/SOUND_RING. [seen] */
export const SOUND_TAIL = 0x801f;
/** MEN_LEFT (0x802b) — active player's working men/lives count; drawn by drawMenLeftPanel, docked at a
 *  round boundary, seeded from STARTING_MEN. Field 1 of the player record; P1/P2 backups PLAYER1_MEN_BACKUP/PLAYER2_MEN_BACKUP (0x802c/0x802d). [seen] */
export const MEN_LEFT = 0x802b;
/** INITIALS_REMAINING (0x804b) — high-score initials-entry down-counter (seeded 3, →0 ends entry). [code] */
export const INITIALS_REMAINING = 0x804b;
/** COINS_PER_CREDIT_A (0x804c) — DSW coin cost for coin line 2 (0 = free play). NOT bonus/lives. [seen] */
export const COINS_PER_CREDIT_A = 0x804c;
/** COINS_PER_CREDIT_B (0x804d) — DSW coin cost for coin line 3. [seen] */
export const COINS_PER_CREDIT_B = 0x804d;
/** LOOP_DELAY_BASE (0x804e) — DSW main-loop pacing base that MAIN_LOOP_DELAY derives from. [seen] */
export const LOOP_DELAY_BASE = 0x804e;
/** STARTING_MEN (0x8053) — DSW starting lives ((dsw&0x40)?4:3); startGame seeds MEN_LEFT from it. [seen] */
export const STARTING_MEN = 0x8053;
/** REACTION_OBJ_CODE (0x8095) — sprite/frame-code byte (byte1) of the reaction object's 4-byte record
 *  (ends REACTION_OBJ_X/Y already named). [seen] */
export const REACTION_OBJ_CODE = 0x8095;
/** REACTION_OBJ_ATTR (0x8096) — attribute/anim byte (byte2) of that reaction record. [seen] */
export const REACTION_OBJ_ATTR = 0x8096;
/** ENEMY2_MOVE_PERIOD (0x8107) — OBJ2 mover cadence reload period; structural mirror of ENEMY1_MOVE_PERIOD. [seen] */
export const ENEMY2_MOVE_PERIOD = 0x8107;
/** ENEMY2_TARGET_COL (0x8109) — OBJ2 mover target column (seed 5 → stepEnemyMover steer path); mirror of ENEMY1_TARGET_COL. [seen] */
export const ENEMY2_TARGET_COL = 0x8109;
/** ENEMY1_TIMER (0x80f0) — OBJ1 mover cadence/dwell countdown (record offset 8). [seen] */
export const ENEMY1_TIMER = 0x80f0;
/** ENEMY1_STATE (0x80f5) — OBJ1 mover signed state byte stepEnemyMover sign-dispatches on (record offset 13). [seen] */
export const ENEMY1_STATE = 0x80f5;
/** ENEMY2_TIMER (0x8101) — OBJ2 mover cadence/dwell countdown (mirror of ENEMY1_TIMER). [seen] */
export const ENEMY2_TIMER = 0x8101;
/** ENEMY2_STATE (0x8106) — OBJ2 mover signed state byte (mirror of ENEMY1_STATE). [seen] */
export const ENEMY2_STATE = 0x8106;
/** ENEMY_WORK_MOVE_PERIOD (0x8091) — working-block mover cadence reload period (parallels ENEMY1_MOVE_PERIOD). [seen] */
export const ENEMY_WORK_MOVE_PERIOD = 0x8091;
/** ENEMY_WORK_TARGET_COL (0x8093) — working-block mover target column stepEnemyMover steers toward. [seen] */
export const ENEMY_WORK_TARGET_COL = 0x8093;
/** CARVE_SEAM_LEFT (0x807e) — flag advanceDigCarveObject sets when a dug channel abuts the object's tile column on
 *  one side; stepObjectRowFlipped reads it to defer that step. Axis confirmed screen-HORIZONTAL; the specific
 *  left-vs-right assignment is rotation-ambiguous (which arm is "left" is not pinned). [seen] */
export const CARVE_SEAM_LEFT = 0x807e;
/** CARVE_SEAM_RIGHT (0x807f) — mirror seam flag for the opposite move arm (stepObjectRowUnflipped reads it). [seen] */
export const CARVE_SEAM_RIGHT = 0x807f;
/** LASER_SCAN_PTR (0x809a, 16-bit) — tilemap cell the horizontal terrain-scroll walker samples. [seen] */
export const LASER_SCAN_PTR = 0x809a;
/** SCROLL_SUBPHASE (0x809e) — sub-tile column phase selecting the ROM stop-tile slice for the scroll. [seen] */
export const SCROLL_SUBPHASE = 0x809e;
/** DROP_QUEUE (0x80c3) — base of the 24-slot pending-spawn column queue (12 left paired to 12 right). [seen] */
export const DROP_QUEUE = 0x80c3;
/** SCORE_READOUT_STRIP (0x8280) — base of a 32-cell work-RAM display strip staging the rightmost
 *  on-screen score-readout column. [code] */
export const SCORE_READOUT_STRIP = 0x8280;
/** ENEMY3_SPRITE_SLOT (0x8238) — sprite-staging slot 6 (SPRITE_STAGING_BASE+24), the actor body's record. [seen] */
export const ENEMY3_SPRITE_SLOT = 0x8238;
/** ENEMY3_SPRITE_ATTR (0x823a) — byte 2 (color+priority) of the ENEMY3 actor sprite-staging record
 *  (ENEMY3_SPRITE_SLOT 0x8238, slot 6), copied from ENEMY3_ATTR by stageActorSpriteRecords. [seen] */
export const ENEMY3_SPRITE_ATTR = 0x823a;
/** ENEMY3_TWIN_SPRITE_SLOT (0x823c) — sprite-staging slot 7 (SPRITE_STAGING_BASE+28), the twin's record. [seen] */
export const ENEMY3_TWIN_SPRITE_SLOT = 0x823c;
/** ENEMY3_TWIN_SPRITE_ATTR (0x823e) — byte 2 (color+priority) of the ENEMY3 twin sprite-staging record
 *  (ENEMY3_TWIN_SPRITE_SLOT 0x823c, slot 7), copied from ENEMY3_TWIN_ATTR; mirror of ENEMY3_SPRITE_ATTR. [seen] */
export const ENEMY3_TWIN_SPRITE_ATTR = 0x823e;
/** ENEMY3_TWIN_SPRITE_Y (0x823f) — byte 3 (Y) of the ENEMY3 twin's 4-byte sprite-staging record
 *  (ENEMY3_TWIN_SPRITE_SLOT 0x823c); last byte of the sprite-staging wipe block. [seen] */
export const ENEMY3_TWIN_SPRITE_Y = 0x823f;

// ── Centralized 2026-07-31: cells previously referenced by raw hex or by a LOCAL const
//    inside one routine, promoted to the single registry (proposer≠confirmer: two blind
//    derivations + a third adjudicator on splits). Records are cross-referenced in prose.
//    GROUNDED 2026-07-31: 18 of these were lifted [code]→[seen] by MAME capture (dig-gameplay
//    + attract), a blind confirmer independently re-deriving each — 7 hit the code-predicted
//    EXACT value (level=1, men=3, REACTION_PERIOD=0x18, DIG_OBJ_TIMER_RELOAD=0x20, ENEMY3
//    MOVE_PERIOD=7, SECONDS_PRESCALER /60→60, DEMO_STEER_SERVICE_TIMER reload 0x1e). The rest
//    stay [code] (weakly-discriminating: ENEMY_WORK_ATTR/ENEMY1_Y; or the tape never reached
//    them: the 2-player / walk / colour-test / twin-spawn cells). See mechanisms.md. ──
/** Per-frame 60->reload-60 down-divider (twin of the named FRAME_COUNTER_PRESCALER 0x8007); read
 *  and branched every frame, its once-per-second rollover decrements 0x800f. [seen] */
export const SECONDS_PRESCALER = 0x8006;
/** 30-frame reload countdown inside the attract demo's player-steering classifier (loc_03e8 /
 *  steerDemoPlayer); when it hits 0 it reloads to 0x1e and fires the classifier's periodic
 *  housekeeping call (0x48c4). Seeded to 1 so it fires on the first frame. [seen] */
export const DEMO_STEER_SERVICE_TIMER = 0x800b;
/** Cached maze-region index in the demo-steer classifier: a stationary demo player re-tests only
 *  the boundary block for the region it was last in; a block that heads a new region rewrites this
 *  hint to that region's index. Reset to 0 at round init. [seen] */
export const DEMO_STEER_BAND_HINT = 0x800c;
/** Colour-test screen per-pass fill-colour byte; also the 0x80->0xFF pass loop counter (each pass
 *  floods colour RAM 0x8800-0x8BFF with this value). [seen] */
export const COLOUR_TEST_FILL = 0x8012;
/** Player 1's backup copy of the LEVEL field (offset 0 of the interleaved [working,P1,P2] per-
 *  player record based at LEVEL 0x8028). loadPlayerState restores it into working LEVEL for
 *  P1's turn; saveActivePlayerRecord writes it; enterPlayMode seeds it to 3 so the attract demo
 *  plays at level 3. [seen] */
export const PLAYER1_LEVEL_BACKUP = 0x8029;
/** Player 1's backup copy of the working man count MEN_LEFT (field 1, offset 3 of the interleaved
 *  player record). Read as a round-boundary condition byte (P1 men-left test that routes to
 *  next-round setup vs end-of-round teardown); written by saveActivePlayerRecord. [seen] */
export const PLAYER1_MEN_BACKUP = 0x802c;
/** Player 2's backup copy of the working man count (field 1, offset 3 of P2's record). At the P1
 *  round boundary it is cleared ('the other player's backup man count'); read as a condition
 *  byte by the round-boundary phase sequencer; written by saveActivePlayerRecord. [seen] */
export const PLAYER2_MEN_BACKUP = 0x802d;
/** Signed per-frame motion mode of the tracked object/actor: dispatcher branches on its sign; each
 *  stepper then rewrites it with the derived sub-tile phase, so it also carries the walk phase;
 *  0 = at rest. [seen] */
export const OBJECT_MOTION_MODE = 0x8075;
/** Column the active/tracked object is locked (committed) to; 0 = free. Nonzero freezes the player
 *  dispatcher into redraw-only, and the mover latches it to the target column 0x8093 on
 *  arrival/catch. [seen] */
export const LOCKED_COLUMN = 0x807a;
/** Horizontal position byte (offset 0, the base) of the enemy/object work-slot scratch record;
 *  stepped one pixel by the left/right movers and drives the walk-frame phase. [seen] */
export const ENEMY_WORK_X = 0x8083;
/** Sprite attribute/color byte (offset 2) of the enemy work-slot record; color-cycled by
 *  advanceDormantMover (v+1 & 0xf7, holding priority bit3 clear), then copied back to the live
 *  enemy's ATTR. [seen] */
export const ENEMY_WORK_ATTR = 0x8085;
/** Vertical / sub-row position byte (offset 3) of the enemy work-slot record; stepped one pixel by
 *  the up/down movers and used as the tile-probe row alignment. [seen] */
export const ENEMY_WORK_Y = 0x8086;
/** Reload/period constant (0x18 = 24) for the reaction step timer REACTION_TIMER (0x80a4); read to
 *  re-arm the timer each time a reaction is armed. [seen] */
export const REACTION_PERIOD = 0x80a3;
/** Raw tile code of the cell one step AHEAD/neighbouring the object, recorded before the
 *  table-0x1ce0 classification lookup that produces the classified NEXT_TILE (0x80a8). [seen] */
export const AHEAD_TILE_RAW = 0x80a6;
/** 16-bit VRAM cell pointer for the dig-carve / falling-hazard object -- the live cell being
 *  drawn/erased; dereferenced through IX. [seen] */
export const CARVE_CELL_PTR = 0x80af;
/** Reload/lifetime constant (seeded 0x20) copied into the dig-carve/falling-hazard lifetime timer
 *  DIG_OBJ_TIMER (0x80b1) when the object spawns. [seen] */
export const DIG_OBJ_TIMER_RELOAD = 0x80c2;
/** Horizontal bounce velocity (+1 / -1 = 0xff) of the left-chamber creature; added to
 *  CHAMBER_CREATURE_X (0x80db) each frame, sign flipped at the bounce bounds. [seen] */
export const CHAMBER_CREATURE_X_VELOCITY = 0x80df;
/** Accelerating vertical fall step/velocity for CHAMBER_CREATURE_FALL_Y (0x80de); pre-incremented
 *  each frame (start 0xfc = -4, so it rises then accelerates down), reset when the creature re-
 *  drops. [seen] */
export const CHAMBER_CREATURE_FALL_STEP = 0x80e0;
/** 16-bit scratch holding the source pointer into tile-pattern table 0x3048 for the Pit floor-
 *  reveal / chamber pattern copy; stored then reloaded into IX (an HL->IX spill). [seen] */
export const PATTERN_SOURCE_PTR = 0x80e1;
/** Y coordinate (offset +3) of the enemy-1 17-byte record; published to sprite byte 3 with the flip
 *  bias. [seen] */
export const ENEMY1_Y = 0x80eb;
/** Signed mover state byte (offset +13) of the enemy-3 primary record; dispatched on sign by the
 *  generic mover. [seen] */
export const ENEMY3_STATE = 0x8117;
/** Cadence reload period (offset +14) of enemy-3 primary; level-scaled step speed reloaded into the
 *  mover timer. [seen] */
export const ENEMY3_MOVE_PERIOD = 0x8118;
/** Target tile column (offset +16) of enemy-3 primary; mover fast-exits/keys direction on it.
 *  [seen] */
export const ENEMY3_TARGET_COL = 0x811a;
/** Low byte of the enemy-3 twin per-step move vector (offset +4). [code] */
export const ENEMY3_TWIN_STEP_X = 0x811f;
/** High byte of the enemy-3 twin per-step move vector (offset +5). [code] */
export const ENEMY3_TWIN_STEP_Y = 0x8120;
/** Signed mover state byte (offset +13) of the enemy-3 twin record. [seen] */
export const ENEMY3_TWIN_STATE = 0x8128;
/** Cadence reload period (offset +14) of the enemy-3 twin record; level-scaled step speed. [seen] */
export const ENEMY3_TWIN_MOVE_PERIOD = 0x8129;
/** Target tile column (offset +16) of the enemy-3 twin record. [seen] */
export const ENEMY3_TWIN_TARGET_COL = 0x812b;
/** Base of hardware sprite-record slot 3 (4 bytes: X, frame, attr, Y) where the left-chamber
 *  creature is staged each frame. [seen] */
export const CHAMBER_CREATURE_SPRITE = 0x822c;
/** Base of the first of three 9-byte on-screen numeric-readout display records
 *  (0x8283/0x828c/0x8295): a 3-byte header copied from a ROM template + 4 digit cells (at +3) +
 *  2 blanks. [seen] */
export const SCORE_READOUT_DEST = 0x8283;
/** SCORE_READOUT_DEST_2 (0x828c) — base of the second of three 9-byte on-screen numeric-readout display
 *  records (SCORE_READOUT_DEST + 9): 3 label tiles + 4 digit cells + 2 blanks. [seen] */
export const SCORE_READOUT_DEST_2 = 0x828c;
/** SCORE_READOUT_DEST_3 (0x8295) — base of the third of three 9-byte numeric-readout display records
 *  (SCORE_READOUT_DEST + 18): 3 label tiles + 4 digit cells + 2 blanks; occupies 0x8295-0x829d. [seen] */
export const SCORE_READOUT_DEST_3 = 0x8295;
/** RIGHT_EDGE_TILE_STRIP_END (0x829d) — last (highest-address) cell of the 28-byte right-edge tile strip
 *  (0x8282-0x829d) drawn by drawRightEdgeColumn; also the final trailing blank of SCORE_READOUT_DEST_3. [seen] */
export const RIGHT_EDGE_TILE_STRIP_END = 0x829d;
/** Initial stack pointer = top of work RAM (0x8000-0x83ff); every boot / state-entry routine re-
 *  seats SP here, discarding the caller's frame. [code] */
export const STACK_TOP = 0x83ff;

// --- ROM tile/glyph source tables + coinage value words (thepit inline Class-B; [code]) ---
/** COINAGE_WORD_A1_B2 (0x0201) — Packed little-endian coins-per-credit VALUE word (not an address) written by applyDipSwitches to mem16[COINS_PER_CREDIT_A] (0x804c/0x804d): low byte 0x01 = coin… [code] */
export const COINAGE_WORD_A1_B2 = 0x0201;
/** COINAGE_WORD_A2_B3 (0x0302) — Packed little-endian coins-per-credit VALUE word written by applyDipSwitches to mem16[COINS_PER_CREDIT_A]: low byte 0x02 = coin line A cost, high byte 0x03 = co… [code] */
export const COINAGE_WORD_A2_B3 = 0x0302;
/** COINAGE_WORD_A2_B4 (0x0402) — Packed little-endian coins-per-credit VALUE word written by applyDipSwitches to mem16[COINS_PER_CREDIT_A]: low byte 0x02 = coin line A cost, high byte 0x04 = co… [code] */
export const COINAGE_WORD_A2_B4 = 0x0402;
/** DIG_OBJECT_DROP_QUEUE_SEED_TABLE (0x2dab) — 24-byte ROM parameter table (a 12-entry column/X-position ramp, duplicated) block-copied FORWARD into the dig-object control block's DROP_QUEUE (0x80c3) at roun… [seen] */
export const DIG_OBJECT_DROP_QUEUE_SEED_TABLE = 0x2dab;
/** SETUP_COINAGE_PLURAL_LABEL_GLYPHS (0x496c) — ROM 7-glyph label-run source (run=7) for the PLURAL (coinage count != 0) form of a round-setup coinage COUNT field; loaded into IX (oracle loc_3a6f: `ld ix,0x49… [seen] */
export const SETUP_COINAGE_PLURAL_LABEL_GLYPHS = 0x496c;
/** SHARED_PANEL_COL7_LABEL_GLYPHS (0x497b) — Fixed 15-glyph ROM tile-code label strip (span 0x496d..0x497b), walked BACKWARD by copyTileColumn (handed the top byte, src steps -1 while dest steps +32 down t… [seen] */
export const SHARED_PANEL_COL7_LABEL_GLYPHS = 0x497b;
/** SETUP_COINAGE_SINGULAR_LABEL_GLYPHS (0x49ae) — ROM 9-glyph label-run source (run=9) for the SINGULAR (coinage count == 0) form of a round-setup coinage COUNT field; loaded into IX (oracle loc_3a6f: `ld ix,0x… [seen] */
export const SETUP_COINAGE_SINGULAR_LABEL_GLYPHS = 0x49ae;
/** SHARED_PANEL_COL13_LABEL_GLYPHS (0x49f7) — Fixed 15-glyph ROM tile-code label strip (span 0x49e9..0x49f7), walked BACKWARD by copyTileColumn. drawSharedPanel's THIRD labelled run, plotted down tile colum… [seen] */
export const SHARED_PANEL_COL13_LABEL_GLYPHS = 0x49f7;
/** BONUS_SCREEN_ROW1_TIER5_STRIP (0x4a14) — ROM 12-glyph tile-code strip (run=12) for the TIER-5 (default/lowest, fall-through of the 15/10 tests) variant of the FIRST upper text row (col15/row11) of the … [seen] */
export const BONUS_SCREEN_ROW1_TIER5_STRIP = 0x4a14;
/** BONUS_SCREEN_ROW1_TIER10_STRIP (0x4a21) — ROM 12-glyph tile-code strip (run=12) for the TIER-10 variant of the FIRST upper text row (col15/row11) of the tier/bonus status screen (showBonusScreen/loc_3be… [seen] */
export const BONUS_SCREEN_ROW1_TIER10_STRIP = 0x4a21;
/** BONUS_SCREEN_ROW1_TIER15_STRIP (0x4a2e) — ROM 12-glyph tile-code strip (run=12) for the TIER-15 variant of the FIRST upper text row (col15/row11) of the tier/bonus status screen (showBonusScreen/loc_3be… [seen] */
export const BONUS_SCREEN_ROW1_TIER15_STRIP = 0x4a2e;
/** BONUS_SCREEN_ROW2_TIER5_STRIP (0x4a3b) — ROM 12-glyph tile-code strip (run=12) for the TIER-5 (default/lowest) variant of the SECOND upper text row (col17/row11) of the tier/bonus status screen (showBo… [seen] */
export const BONUS_SCREEN_ROW2_TIER5_STRIP = 0x4a3b;
/** BONUS_SCREEN_ROW2_TIER10_STRIP (0x4a48) — ROM 12-glyph tile-code strip (run=12) for the TIER-10 variant of the SECOND upper text row (col17/row11) of the tier/bonus status screen (showBonusScreen/loc_3b… [seen] */
export const BONUS_SCREEN_ROW2_TIER10_STRIP = 0x4a48;
/** BONUS_SCREEN_ROW2_TIER15_STRIP (0x4a55) — ROM 12-glyph tile-code strip (run=12) for the TIER-15 variant of the SECOND upper text row (col17/row11) of the tier/bonus status screen (showBonusScreen/loc_3b… [seen] */
export const BONUS_SCREEN_ROW2_TIER15_STRIP = 0x4a55;
/** HISCORE_RANK0_LABEL_STRIP (0x4a68) — ROM 18-tile label-column strip naming the DEFAULT/lowest rank (else-branch, record HIGH_SCORE_TABLE+0) on the high-score initials-entry screen. loc_4df8 loads i… [seen] */
export const HISCORE_RANK0_LABEL_STRIP = 0x4a68;
/** HISCORE_RANK2_LABEL_STRIP (0x4a7b) — ROM 18-tile label-column strip naming the selector==2 rank (record HIGH_SCORE_TABLE+5) on the high-score initials-entry screen. loc_4df8 loads it into IX at 0x4… [seen] */
export const HISCORE_RANK2_LABEL_STRIP = 0x4a7b;
/** HISCORE_RANK3_LABEL_STRIP (0x4a8e) — ROM 18-tile label-column strip naming the selector==3 rank (record HIGH_SCORE_TABLE+10) on the high-score initials-entry screen. loc_4df8 loads it into IX at 0x… [code] */
export const HISCORE_RANK3_LABEL_STRIP = 0x4a8e;
/** HIGH_SCORE_INITIALS_PROMPT_GLYPHS (0x4aa9) — Fixed 26-glyph ROM tile-code prompt strip (span 0x4a90..0x4aa9), walked BACKWARD by copyTileColumn. runHighScoreInitialsEntry's fixed prompt line, plotted down … [seen] */
export const HIGH_SCORE_INITIALS_PROMPT_GLYPHS = 0x4aa9;
/** LEFT_EDGE_COLUMN_TILE_STRIP (0x4aab) — ROM 32-byte picture strip copied up video column 0 by drawLeftEdgeColumn into LEFT_EDGE_COLUMN_BOTTOM (0x93e0) to give the fixed left-edge playfield column its tile image. [seen] */
export const LEFT_EDGE_COLUMN_TILE_STRIP = 0x4aab;
/** BOOT_TEXT_COLUMN30_TILE_STRIP (0x4acb) — ROM 32-byte picture strip (= 0x4aab + 0x20, the next strip) copied up tilemap column 30 by drawBestScoresTodayLabel into BOOT_TEXT_COLUMN30_BOTTOM (0x93fe). [seen] */
export const BOOT_TEXT_COLUMN30_TILE_STRIP = 0x4acb;

// --- ROM data-table addresses (thepit Class-B hoist; routine-local consts promoted; [code], stage-B grounding pending) ---
/** PLAYFIELD_TILE_IMAGE_LEVEL_ODD (0x0762) — ROM 0x400-byte (32x32 = 1024-cell) full-screen tilemap image copied into video RAM (0x9000) by paintScreen/loc_0673 to lay the round board; paintScreen selects … [seen] */
export const PLAYFIELD_TILE_IMAGE_LEVEL_ODD = 0x0762;
/** PLAYFIELD_TILE_IMAGE_LEVEL_EVEN (0x0b62) — ROM 0x400-byte (1024-cell) full-screen tilemap image copied into video RAM (0x9000) by paintScreen/loc_0673 for the round board; selected when LEVEL (0x8028) bi… [seen] */
export const PLAYFIELD_TILE_IMAGE_LEVEL_EVEN = 0x0b62;
/** PLAYFIELD_COLOUR_IMAGE (0x0f62) — ROM 0x400-byte (1024-cell) full-screen colour-attribute image copied into colour RAM (0x8800) by paintScreen/loc_0673 to tint the round board; single, NOT level… [seen] */
export const PLAYFIELD_COLOUR_IMAGE = 0x0f62;
/** HORIZ_STEP_EXPECTED_TILE_TABLE (0x1b78) — 360-byte ROM expected-terrain lookup for the CURRENT/UNDER cell during a HORIZONTAL terrain step. Indexed [base + (tile-113)*8 + subOffset], 45 diggable/pushabl… [seen] */
export const HORIZ_STEP_EXPECTED_TILE_TABLE = 0x1b78;
/** HORIZ_STEP_AHEAD_TILE_TABLE (0x1ce0) — 360-byte ROM expected-terrain lookup for the tile ONE STEP AHEAD during a HORIZONTAL terrain step; the off-grid companion of HORIZ_STEP_EXPECTED_TILE_TABLE (0x1… [seen] */
export const HORIZ_STEP_AHEAD_TILE_TABLE = 0x1ce0;
/** DIG_REACT_EXPECTED_TILE_TABLE (0x1e48) — 360-byte ROM expected-terrain lookup for the CURRENT cell in the ACTOR dig-reaction arm (triggerDigReaction). Indexed [base + (tileCode-113)*8 + subCell] over d… [seen] */
export const DIG_REACT_EXPECTED_TILE_TABLE = 0x1e48;
/** DIG_REACT_NEIGHBOUR_TILE_TABLE (0x1fb0) — 360-byte ROM expected-terrain lookup for the NEIGHBOURING cell (actorCellPtr+1) in the ACTOR dig-reaction arm (triggerDigReaction), sampled off a cell boundary … [code] */
export const DIG_REACT_NEIGHBOUR_TILE_TABLE = 0x1fb0;
/** VERT_STEP_EXPECTED_TILE_TABLE (0x2118) — 360-byte ROM expected-terrain lookup for the CURRENT cell during the tracked object's VERTICAL climb/dig-carve step (stepObjectAndResolveTile). Indexed [base + … [seen] */
export const VERT_STEP_EXPECTED_TILE_TABLE = 0x2118;
/** VERT_STEP_NEIGHBOUR_TILE_TABLE (0x2280) — 360-byte ROM expected-terrain lookup for the NEIGHBOURING cell one step back (cellPtr-1) sampled during the object's VERTICAL climb/dig-carve step, reached off … [seen] */
export const VERT_STEP_NEIGHBOUR_TILE_TABLE = 0x2280;
/** STOP_TILE_TABLE (0x277a) — ROM data table (cert=code): eight 32-byte per-sub-column lists of scroll-stop tile codes. The horizontal dig/push scroll (advancePlayerLaser.advanceScroll) sele… [seen] */
export const STOP_TILE_TABLE = 0x277a;
/** DIG_CHANNEL_SEAM_REMAP_TABLE (0x2dc3) — ROM data table (cert=code): 4-entry tile-translation table keyed by dig-channel tile code, index = tile-0x96 (tiles 0x96..0x99 = 150..153), occupying 0x2dc3-0x2… [seen] */
export const DIG_CHANNEL_SEAM_REMAP_TABLE = 0x2dc3;
/** DIG_CARVE_REMAP_TABLE (0x2dc7) — ROM data table (cert=code): 2-D tile-translation table indexed (tile-0x71)*8 + sub-column(E&7) for diggable tiles 0x71..0x99 (113..153), beginning immediately a… [seen] */
export const DIG_CARVE_REMAP_TABLE = 0x2dc7;
/** PIT_FLOOR_REVEAL_PATTERN_TABLE (0x3048) — ROM data table (cert=code): tile-pattern source for the Pit sliding-floor / terrain reveal, stored as consecutive 6-tile columns (TILES_PER_COLUMN). PIT_FLOOR_R… [seen] */
export const PIT_FLOOR_REVEAL_PATTERN_TABLE = 0x3048;
/** PROBE_TILE_TABLE (0x34fe) — code: base of the phase-keyed valid-tile ROM lookup table (32-byte rows, one per sub-tile phase; region 0x34fe-0x35fd, ends where the sibling table 0x35fe begin… [seen] */
export const PROBE_TILE_TABLE = 0x34fe;
/** PROBE_NEXT_TILE_TABLE (0x35fe) — code: sibling phase-keyed valid-tile ROM lookup table (32-byte rows; region 0x35fe-0x36fd, code resumes at loc_36fe) searched for the FOLLOWING/next tile — the … [seen] */
export const PROBE_NEXT_TILE_TABLE = 0x35fe;
/** PREPLAY_FIXED_SCREEN_IMAGE (0x3e32) — ROM 0x400-byte (1024-cell) full-screen tile image stamped into video RAM (0x9000) by showFixedScreen/loc_3b81, which floods the colour map flat with attribute 0… [seen] */
export const PREPLAY_FIXED_SCREEN_IMAGE = 0x3e32;
/** CREDIT_STANDBY_SCREEN_IMAGE (0x4232) — ROM 0x400-byte (1024-cell) full-screen tile image stamped into video RAM (0x9000) by holdFixedScreen/loc_3ba8, flooded flat with background attribute 0x02, over… [seen] */
export const CREDIT_STANDBY_SCREEN_IMAGE = 0x4232;
/** PLAYFIELD_STRIP_COL1_ROW11_TILES (0x494f) — ROM tile-code source table walked BACKWARD (from one byte below the pointer) by copyCappedTileColumn/loc_3ddb to fill the 10-cell (0x0a) vertical tilemap strip … [seen] */
export const PLAYFIELD_STRIP_COL1_ROW11_TILES = 0x494f;
/** CREDIT_LABEL_GLYPHS (0x496d) — ROM glyph-run source for the fixed CREDIT label drawn beneath the live CREDIT_COUNT value in the two credit HUD panels: drawCreditsDisplay (col6/row10) and draw… [seen] */
export const CREDIT_LABEL_GLYPHS = 0x496d;
/** GAME_OVER_LABEL_GLYPHS (0x49a5) — ROM 9-glyph 'GAME OVER' label strip, walked BACKWARD by copyTileColumn (handed the run's last byte) and stamped down a HUD text column: drawGameOverLabel (col1/… [seen] */
export const GAME_OVER_LABEL_GLYPHS = 0x49a5;
/** MEN_LEFT_DEFAULT_LABEL_GLYPHS (0x49ba) — ROM 9-glyph label strip for the DEFAULT (non-singular) variant of drawMenLeftPanel, selected when the live MEN_LEFT byte != 1; drawn at col5/row11 with the live… [seen] */
export const MEN_LEFT_DEFAULT_LABEL_GLYPHS = 0x49ba;
/** MEN_LEFT_ALT_LABEL_GLYPHS (0x49c2) — ROM 8-glyph label strip for the ALTERNATE (singular) variant of drawMenLeftPanel, selected when the live MEN_LEFT byte == 1; drawn at col5/row12 with NO live-va… [seen] */
export const MEN_LEFT_ALT_LABEL_GLYPHS = 0x49c2;
/** PLAYERS_LABEL_GLYPHS (0x49b1) — ROM 7-glyph tile-code strip spelling "PLAYERS" (stored back-to-front, S at 0x49b1 down to P at 0x49ab; char-ROM tiles 1c 1b 0e 22 0a 15 19 draw the letters S R E Y A L P). Walked BACKWARD by copyTileColumn / copyCappedTileColumn; the capped variant caps the top cell, trimming the S -> "PLAYER". Shared source for drawPlayerLabel, drawSharedPanel (col9/row13), showSetupScreen (col18/row12); shares the "PLAY" bytes with the FREE-PLAY run at 0x49ae. [grounded: char-ROM decode] */
export const PLAYERS_LABEL_GLYPHS = 0x49b1;
/** PLAYER_LABEL_GLYPHS (0x49b0) — the same ROM glyph table as PLAYERS_LABEL_GLYPHS pointed one byte lower: the 6-glyph run "PLAYER" (bytes 0x49ab..0x49b0 = P L A Y E R, no trailing S). Walked BACKWARD by copyTileColumn. showSetupScreen's first coinage marker (tile 1) labels "PLAYER" at col12/row13; marker 2 uses the full PLAYERS run -> the "1 PLAYER / 2 PLAYERS" setup labels. [grounded: char-ROM decode] */
export const PLAYER_LABEL_GLYPHS = 0x49b0;
/** BOOT_TEXT_COLUMN25_TILE_STRIP (0x49c7) — ROM 32-tile source strip for tilemap column 25 (video-RAM col 0x19). drawCopyrightLine reads it FORWARD (0x49c7..0x49e6) and lays it bottom-cell-upward from BOO… [seen] */
export const BOOT_TEXT_COLUMN25_TILE_STRIP = 0x49c7;
/** BONUS_SCREEN_ROW3_STRIP (0x4a07) — code: base of the fixed 15-glyph tile-code strip for the THIRD text row of the tier/bonus status screen, plotted at column 21, row 9 via copyTileColumn (source … [seen] */
export const BONUS_SCREEN_ROW3_STRIP = 0x4a07;
/** FILL_TILE_CODE (0x4b0f) — code: a single fixed ROM byte holding a background tile code, read two ways for the same value — as the whole-tilemap wipe/fill stamped into all 1024 video-RAM … [seen] */
export const FILL_TILE_CODE = 0x4b0f;

// --- RAM/MMIO/VRAM cell names (thepit RAM naming pass, understanding stage A; [code] = grounded stage-B later) ---
/** SPRITE_STAGING_WIPE_BASE (0x8200) — Base of the fixed 64-byte work-RAM block (0x8200..0x823f) zeroed one-shot by clearSpriteStagingBuffer at setup; its top half is the sprite-record stag… [code] */
export const SPRITE_STAGING_WIPE_BASE = 0x8200;
/** SPRITE_STAGING_END (0x8240) — Exclusive upper bound of the sprite-staging wipe (SPRITE_STAGING_BASE + 0x40); also the floor of the stack-only region 0x8240..0x87ff that no routine … [code] */
export const SPRITE_STAGING_END = 0x8240;
/** RIGHT_EDGE_TILE_STRIP (0x8282) — Base of the 28-byte work-RAM tile strip (0x8282..0x829d) that drawRightEdgeColumn copies up video column 31 (rows 2..29); dynamic, built in RAM unlike… [seen] */
export const RIGHT_EDGE_TILE_STRIP = 0x8282;
/** COLOUR_COLUMN_ANCHOR (0x8840) — Colour-RAM top-of-column anchor (row 2, col 0 = colour base 0x8800 + two rows). A full-height column fill starts at 0x8840+column and stamps 28 cells … [code] */
export const COLOUR_COLUMN_ANCHOR = 0x8840;
/** JEWEL_GLITTER_COLOUR_7 (0x8873) — Colour-attribute cell of the glitter cycle's slot-7 diamond (paired video/glyph cell 0x9073, animating glyph 0x3a, resting colour 7); recoloured each … [seen] */
export const JEWEL_GLITTER_COLOUR_7 = 0x8873;
/** JEWEL_GLITTER_COLOUR_5 (0x88d9) — Colour-attribute cell of the glitter cycle's slot-5 diamond (paired video/glyph cell 0x90d9, animating glyph 0x3a, resting colour 7); recoloured by gl… [seen] */
export const JEWEL_GLITTER_COLOUR_5 = 0x88d9;
/** TWIN_ACTOR_COLOUR_ANCHOR (0x88e4) — Bottom-left colour-attribute anchor of the two-body ENEMY3 (twin) actor's fixed 4-row x 2-col tile figure, stamped by spawnTwinActor; all eight cells … [seen] */
export const TWIN_ACTOR_COLOUR_ANCHOR = 0x88e4;
/** JEWEL_GLITTER_COLOUR_6 (0x895d) — Colour-attribute cell of the glitter cycle's slot-6 diamond (paired video/glyph cell 0x915d, animating glyph 0x3b, resting colour 3); recoloured by gl… [seen] */
export const JEWEL_GLITTER_COLOUR_6 = 0x895d;
/** SCORE_HUD_COLOUR_UPPER_BOTTOM (0x8961) — Colour/attribute-RAM cell (col 1, row 11): bottom cell of the UPPER score-HUD colour column that redrawScoreHud tints colour 2 walking upward 10 cells… [seen] */
export const SCORE_HUD_COLOUR_UPPER_BOTTOM = 0x8961;
/** JEWEL_GLITTER_COLOUR_3 (0x89b6) — Colour-RAM attribute of one on-screen diamond (col 22, row 13); glitterJewels steps its colour through 8 shades while its tile shows animating glyph 0… [seen] */
export const JEWEL_GLITTER_COLOUR_3 = 0x89b6;
/** JEWEL_GLITTER_COLOUR_4 (0x89fd) — Colour-RAM attribute of a diamond (col 29, row 15); glitterJewels value-4 glitter cell (animating glyph 0x3c, resting colour 3). The value-4 step AND … [seen] */
export const JEWEL_GLITTER_COLOUR_4 = 0x89fd;
/** JEWEL_GLITTER_COLOUR_2 (0x8a7d) — Colour-RAM attribute of a diamond (col 29, row 19); glitterJewels value-2 glitter cell (animating glyph 0x3d, resting colour 3). [seen] */
export const JEWEL_GLITTER_COLOUR_2 = 0x8a7d;
/** RIGHT_EDGE_ACCENT_MID_BOTTOM (0x8a7f) — Colour-RAM cell at right playfield edge (col 31, row 19): bottom of the MIDDLE 3-cell colour-4 accent band painted upward by drawRightEdgeColumn. [seen] */
export const RIGHT_EDGE_ACCENT_MID_BOTTOM = 0x8a7f;
/** LEFT_EDGE_COLOUR3_RUN_BOTTOM (0x8a80) — Colour-RAM cell at fixed left playfield edge (col 0, row 20): bottom anchor of the 10-cell colour-3 tint run drawLeftEdgeColumn paints UPWARD up video… [seen] */
export const LEFT_EDGE_COLOUR3_RUN_BOTTOM = 0x8a80;
/** JEWEL_GLITTER_COLOUR_1 (0x8b3a) — Colour-RAM attribute of a diamond (col 26, row 25); glitterJewels default/value-1 cell (animating glyph 0x3a, resting colour 7), used on countdown val… [seen] */
export const JEWEL_GLITTER_COLOUR_1 = 0x8b3a;
/** RIGHT_EDGE_ACCENT_LOW_BOTTOM (0x8b9f) — Colour-RAM cell at right playfield edge (col 31, row 28): bottom of the LOW 3-cell colour-6 accent band painted upward by drawRightEdgeColumn. [seen] */
export const RIGHT_EDGE_ACCENT_LOW_BOTTOM = 0x8b9f;
/** LEFT_EDGE_COLOUR2_LOWER_RUN_BOTTOM (0x8ba0) — Colour-RAM cell at the fixed left playfield edge (col 0, row 29): bottom (starting) cell of the LOWER of the two 9-cell colour-2 tint runs drawLeftEdgeColumn paints upward at stride 32 (rows 29..21). [seen] */
export const LEFT_EDGE_COLOUR2_LOWER_RUN_BOTTOM = 0x8ba0;
/** SCORE_HUD_COLOUR_LOWER_BOTTOM (0x8ba1) — Colour/attribute-RAM cell (col 1, row 29): bottom cell of the LOWER score-HUD colour column that redrawScoreHud tints colour 2 walking upward 9 cells,… [seen] */
export const SCORE_HUD_COLOUR_LOWER_BOTTOM = 0x8ba1;
/** ENEMY3_FIGURE_COLOUR_ANCHOR (0x8ba3) — Colour-RAM anchor cell (0x8800-0x8BFF, pairs with tilemap anchor 0x93a3 = 0x8ba3+0x800) where the two-body enemy3 (twin / alt-phase) actor stamps the … [seen] */
export const ENEMY3_FIGURE_COLOUR_ANCHOR = 0x8ba3;
/** JEWEL_GLITTER_TILE_7 (0x9073) — Video/tilemap (0x9000-0x93FF) glyph cell for the glitter jewel selected on glitterJewels countdown value 7; read each frame, and if it equals the anim… [seen] */
export const JEWEL_GLITTER_TILE_7 = 0x9073;
/** OTHER_SCORE_COLUMN_BASE (0x90c1) — Video-RAM base cell of the non-player-1 (player 2 / 'any other player') score-digit column; drawScoreDigits stamps the four BCD score digits here one … [seen] */
export const OTHER_SCORE_COLUMN_BASE = 0x90c1;
/** JEWEL_GLITTER_TILE_5 (0x90d9) — Video/tilemap glyph cell for the glitter jewel selected on glitterJewels countdown value 5; read for the animating glyph 0x3a, paired colour cell 0x88… [seen] */
export const JEWEL_GLITTER_TILE_5 = 0x90d9;
/** JEWEL_GLITTER_TILE_6 (0x915d) — Video/tilemap glyph cell for the glitter jewel selected on glitterJewels countdown value 6; read for the animating glyph 0x3b (distinct from the 0x3a … [seen] */
export const JEWEL_GLITTER_TILE_6 = 0x915d;
/** HIGH_SCORE_INITIALS_CELL_RANK3 (0x915f) — Video-RAM cell where the entered initial blinks during high-score initials entry for the rank picked by selector/VARIANT==3 (record HIGH_SCORE_TABLE+1… [code] */
export const HIGH_SCORE_INITIALS_CELL_RANK3 = 0x915f;
/** SETUP_COINAGE_A_PLURAL_CELL (0x918e) — Setup-screen video-RAM cell above the first coinage field (COINS_PER_CREDIT_A, column 14): showSetupScreen patches it to glyph 0x24 (=BLANK_TILE 36) o… [seen] */
export const SETUP_COINAGE_A_PLURAL_CELL = 0x918e;
/** JEWEL_GLITTER_TILE_3 (0x91b6) — Video/tilemap glyph cell for the glitter jewel selected on glitterJewels countdown value 3; read for the animating glyph 0x3a, paired colour cell 0x89… [seen] */
export const JEWEL_GLITTER_TILE_3 = 0x91b6;
/** JEWEL_GLITTER_TILE_4 (0x91fd) — glitterJewels CELLS[4] video/tilemap glyph cell (paired colour cell 0x89fd, animating glyph 0x3c, resting colour 3). Read to test for the animating di… [seen] */
export const JEWEL_GLITTER_TILE_4 = 0x91fd;
/** MOUNTAIN_ERODE_SOUND_MARKER_TILE (0x9264) — seedMountainErosion tilemap marker cell: `if (mem8[0x9264]===0x32) requestSound21(m)` — holding trigger tile 0x32 cues the Zonker/erosion sound. Only … [seen] */
export const MOUNTAIN_ERODE_SOUND_MARKER_TILE = 0x9264;
/** JEWEL_GLITTER_TILE_2 (0x927d) — glitterJewels CELLS[2] video/tilemap glyph cell (paired colour cell 0x8a7d, animating glyph 0x3d, resting colour 3). Selected on countdown value 2. On… [seen] */
export const JEWEL_GLITTER_TILE_2 = 0x927d;
/** HISCORE_RANK2_INITIALS_TILE (0x927f) — runHighScoreInitialsEntry rankDisplay selector 2: on-screen video cell where the middle rank's initials blink during initials entry (fills HIGH_SCORE_… [seen] */
export const HISCORE_RANK2_INITIALS_TILE = 0x927f;
/** SETUP_COINAGE_A_MARKER_TILE (0x928c) — showSetupScreen: `mem8[0x928c]=1` — fixed marker/numeral cell heading the first credit-config (coinage A) record before its 6-tile label run is copied… [seen] */
export const SETUP_COINAGE_A_MARKER_TILE = 0x928c;
/** SETUP_COINAGE_A_COUNT_TILE (0x928e) — showSetupScreen stampCountField(m,0x928e,countA,14): first count-record digit cell on the round-setup screen; its tile is COINS_PER_CREDIT_A (DSW coin… [seen] */
export const SETUP_COINAGE_A_COUNT_TILE = 0x928e;
/** SETUP_COINAGE_B_MARKER_TILE (0x9292) — showSetupScreen: `mem8[0x9292]=2` — fixed marker/numeral cell heading the second credit-config (coinage B) record before its 7-tile label run at col18… [seen] */
export const SETUP_COINAGE_B_MARKER_TILE = 0x9292;
/** SETUP_COINAGE_B_COUNT_TILE (0x9294) — showSetupScreen stampCountField(m,0x9294,countB,20): second count-record digit cell on the round-setup screen; its tile is COINS_PER_CREDIT_B (DSW coi… [seen] */
export const SETUP_COINAGE_B_COUNT_TILE = 0x9294;
/** MOUNTAIN_ERODE_SPAWN_TILE (0x92a4) — erodeMountain landmark cell: when the fill cursor MOUNTAIN_ERODE_PTR steps to exactly this address (`if (ptr!==0x92a4) return`) it finalises the erosi… [seen] */
export const MOUNTAIN_ERODE_SPAWN_TILE = 0x92a4;
/** P1_SCORE_COLUMN_BASE (0x9301) — drawScoreDigits player-1 score-column base: the four BCD score digits are stamped here and at +32/+64/+96 (one tilemap row apart) when ACTIVE_PLAYER==… [seen] */
export const P1_SCORE_COLUMN_BASE = 0x9301;
/** JEWEL_GLITTER_TILE_1 (0x933a) — Video-RAM tile byte of glitterJewels' default glitter cell (countdown value 1, and any stray value outside 2..7); read each cycle to decide whether it… [seen] */
export const JEWEL_GLITTER_TILE_1 = 0x933a;
/** PIT_FLOOR_REVEAL_COLUMN_BOTTOM (0x938c) — Bottom video-RAM cell of the sliding pit-floor / terrain reveal column; 6 tiles (TILES_PER_COLUMN) are stamped upward from here (cell -= 32 per tile) … [seen] */
export const PIT_FLOOR_REVEAL_COLUMN_BOTTOM = 0x938c;
/** HISCORE_INITIALS_RANK0_CELL (0x939f) — Video-RAM cell where the rank-0 (default/lowest) high-score record's initials blink during initials entry; runHighScoreInitialsEntry.rankDisplay() ret… [seen] */
export const HISCORE_INITIALS_RANK0_CELL = 0x939f;
/** ENEMY3_FIGURE_ANCHOR_CELL (0x93a3) — Tilemap anchor (bottom-left) cell of the ENEMY3 twin / alt-phase two-body actor's 2-wide x 4-tall tile figure; the 8 cells are stamped at fixed offset… [seen] */
export const ENEMY3_FIGURE_ANCHOR_CELL = 0x93a3;
/** RIGHT_EDGE_COLUMN_BOTTOM (0x93bf) — Bottom cell of the right-edge playfield tile column (video column 31); drawRightEdgeColumn copies a 28-byte dynamic tile strip from work RAM (0x8282) … [code] */
export const RIGHT_EDGE_COLUMN_BOTTOM = 0x93bf;
/** LEFT_EDGE_COLUMN_BOTTOM (0x93e0) — Bottom cell of the fixed left-edge playfield tile column (video column 0, all 32 rows); drawLeftEdgeColumn copies a 32-byte picture strip (0x4aab) upw… [code] */
export const LEFT_EDGE_COLUMN_BOTTOM = 0x93e0;
/** BOOT_TEXT_COLUMN25_BOTTOM (0x93f9) — Bottom cell of a fixed 32-tile boot/attract-screen text column laid into tilemap column 25; drawCopyrightLine copies a 32-tile strip (0x49c7) upward f… [code] */
export const BOOT_TEXT_COLUMN25_BOTTOM = 0x93f9;
/** BOOT_TEXT_COLUMN30_BOTTOM (0x93fe) — Bottom cell of a fixed boot/attract-screen tile column laid into tilemap column 30; drawBestScoresTodayLabel copies a 32-byte picture strip (0x4acb) u… [code] */
export const BOOT_TEXT_COLUMN30_BOTTOM = 0x93fe;
/** VIDEO_RAM_LAST_CELL (0x93ff) — Last (inclusive) cell of the 0x9000-0x93FF tilemap; used as the upper loop bound (cell <= 0x93ff) when fillVideoRam paints all 1024 cells with the bac… [code] */
export const VIDEO_RAM_LAST_CELL = 0x93ff;
/** VIDEO_RAM_END_EXCLUSIVE (0x9400) — One-past-the-end (exclusive upper bound) of tilemap RAM 0x9000-0x93FF; erodeMountain stops extending its fill column once the write cursor reaches thi… [code] */
export const VIDEO_RAM_END_EXCLUSIVE = 0x9400;
/** ATTR_SCROLL_RAM_BASE (0x9800) — VRAM structural base of the attribute / column-scroll RAM region (0x9800-0x983F, one byte per column), which is also the base of the whole contiguous … [code] */
export const ATTR_SCROLL_RAM_BASE = 0x9800;
/** SPRITE_RAM_BASE (0x9840) — base of hardware sprite RAM (0x9840-0x985F = 8 sprites x 4 bytes); the
 *  per-frame NMI LDIRs the SPRITE_STAGING_BASE staging buffer into this region every vblank. [seen] */
export const SPRITE_RAM_BASE = 0x9840;
/** JOYSTICK_INPUT_PORT (0xa000) — MMIO input port IN0 (read): 8-way joystick + dig/fire. Read once in serviceVblankNmi.debounceInputs as `mem8[0xa000] // joystick/dig port`. Board io.r… [seen] */
export const JOYSTICK_INPUT_PORT = 0xa000;
/** COIN_START_PORT (0xa800) — MMIO input port IN1 (read): coin + start switches, ACTIVE HIGH (idle 0x00, a press sets its bit). Read in serviceVblankNmi.debounceInputs as `mem8[0xa… [seen] */
export const COIN_START_PORT = 0xa800;
/** SOUND_ENABLE_LATCH (0xb003) — MMIO WRITE: LS259 control latch bit 3 = master sound-enable line (data on d0). enableSound writes 1 (unmute), disableSound writes 0 (mute). [seen] */
export const SOUND_ENABLE_LATCH = 0xb003;
/** DSW_PORT (0xb000) — DIP-switch input port (READ side of 0xB000): the LS157-muxed DSW byte applyDipSwitches decodes. [seen] */
export const DSW_PORT = 0xb000;
/** NMI_MASK_LATCH (0xb000) — LS259 control-latch bit0 (WRITE side of 0xB000): 1 arms / 0 masks the vblank NMI. [code] */
export const NMI_MASK_LATCH = 0xb000;
/** FLIP_SCREEN_X_LATCH (0xb006) — LS259 mainlatch line 6 (WRITE side of 0xB006): horizontal screen flip
 *  (flipX) + sprite mux; applyDipSwitches writes the decoded cocktail flip bit (low bit latched). [seen] */
export const FLIP_SCREEN_X_LATCH = 0xb006;
/** FLIP_SCREEN_Y_LATCH (0xb007) — LS259 mainlatch line 7 (WRITE side of 0xB007): vertical screen flip
 *  (flipY); applyDipSwitches writes the decoded cocktail flip bit (low bit latched). [seen] */
export const FLIP_SCREEN_Y_LATCH = 0xb007;
/** WATCHDOG_KICK (0xb800) — Watchdog reset (READ side of 0xB800): reading it kicks the watchdog. [seen] */
export const WATCHDOG_KICK = 0xb800;
/** SOUND_CMD_LATCH (0xb800) — Sound-command latch (WRITE side of 0xB800): the byte handed to the audio Z80. [code] */
export const SOUND_CMD_LATCH = 0xb800;
/** LEFT_EDGE_COLOUR2_UPPER_RUN_BOTTOM (0x8940) — Colour-RAM cell at the fixed left playfield edge (col 0, row 10): bottom (starting) cell of the UPPER 9-cell colour-2 tint run drawLeftEdgeColumn paints upward at stride 32 (rows 10..2). [seen] */
export const LEFT_EDGE_COLOUR2_UPPER_RUN_BOTTOM = 0x8940;
/** loc_895f (0x895f) — Colour-RAM cell at column 31 / row 10 written by TWO different features: drawRightEdgeColumn's top 3-cell accent band (bottom cell, colour 7, rows 10/… [guess] (placeholder; names-debt) */
export const loc_895f = 0x895f;
/** MOUNTAIN_CAP_TILE_CELL (0x90c4) — Underdetermined dual-writer video-RAM cell: seedMountainErosion stamps it to 0xac as the mountain-cap cell one tilemap row above the 0x90e4 head; spaw… [seen] (placeholder; names-debt) */
export const MOUNTAIN_CAP_TILE_CELL = 0x90c4;
/** MOUNTAIN_ERODE_HEAD_TILE_CELL (0x90e4) — Underdetermined dual-writer video-RAM cell: seedMountainErosion checks it for the 0xfe marker then stamps 0xae as the mountain-erosion head cell; spaw… [seen] (placeholder; names-debt) */
export const MOUNTAIN_ERODE_HEAD_TILE_CELL = 0x90e4;
/** MOUNTAIN_ERODE_VRAM_HEAD (0x9104) — head (top) tilemap cell of the mountain column the Zonker erodes
 *  (VIDEO_RAM_BASE + row8*32 + col4); seedMountainErosion seeds the erosion pointer here, erodeMountain
 *  walks +0x20 down-column. [seen] */
export const MOUNTAIN_ERODE_VRAM_HEAD = 0x9104;

// ═══ ROUTINE LABELS ═══════════════════════════════════════════════════════════
// Address → { name, role, cert } for every named main-CPU routine (ROM 0x0000-0x4FFF).
// names.js is the canonical NAMES registry for The Pit: work-RAM cells (above) and
// ROM routine labels (here). Keeping both in one place lets the understanding phase
// — and any external artifact, e.g. the Computer Archeology disassembly — resolve a
// name for an address WITHOUT reading the JavaScript port (translated/ / idiomatic/),
// so port-implementation detail can never leak into a plain-ROM listing.
//
// Each entry carries the same shape as the RAM-cell descriptions above:
//   name — the routine's camelCase label, mirroring its idiomatic/<name>.js file (the
//          source of truth; regenerate when a routine is renamed).
//   role — a one-line game-behaviour summary distilled from the routine's header
//          docstring and mechanisms.md (what it does in play, not how it is coded).
//   cert — grounding level of that role, mirroring mechanisms.md's tags:
//            "seen"  — the behaviour was observed live in MAME (its subsystem is [seen]
//                      in mechanisms.md: the laser, movers/enemies, scoring, digging/loot,
//                      erosion + rescue-ship, chamber-creature motion, death/board-flow,
//                      high-score entry, the grounded sound events, …).
//            "code"  — proven from the code + the named map, not directly observed (a
//                      [code] helper: draw/fill, RNG, DSW decode, sound-enqueue, boot,
//                      setup/dispatch/classify — the lift is faithful, the role inferred).
//            "guess" — the mechanism is understood but the game-purpose is inferred/
//                      unobserved (mechanisms.md still tags it [guess]).
export const ROUTINES = {
  0x0000: { name: "resetVector", role: "power-on reset entry — hands straight to cold-boot init and never returns", cert: "seen" },
  0x0066: { name: "serviceVblankNmi", role: "vblank NMI — the per-frame service (input debounce, sound-ring drain, sprite DMA, coin/credit watchdog, /60 timers)", cert: "seen" },
  0x01a4: { name: "coldBootInit", role: "cold boot — bring the machine up from reset, seed work RAM, run the one-time screen/table/sound setup, then hand to attract", cert: "seen" },
  0x01f9: { name: "rearmMachineAndBranchOnCredits", role: "boot/restart entry — re-arm the machine, then branch on the credit count to the held credit screen or into play", cert: "seen" },
  0x021c: { name: "showCreditScreen", role: "credit-standby entry — arm game-mode 3, reset the stack, enable the frame interrupt, blank the screen, then hold a static credit screen", cert: "seen" },
  0x022d: { name: "startGame", role: "set up a fresh game once a credit registers (seed lives from the DSW) and enter play", cert: "seen" },
  0x0278: { name: "dockManAndDispatchRoundBoundary", role: "round-boundary dispatcher — decrement the active player's lives (the death path) + persist their record, then route to next-round setup or game-over teardown", cert: "seen" },
  0x02a1: { name: "stepRoundSubPhaseAndBranch", role: "sequence the round sub-phase byte and hand off to round setup or teardown", cert: "seen" },
  0x02ca: { name: "setUpRoundAndHoldIntro", role: "one-time round-start setup — load saved progress, configure difficulty from the DSW, unmute audio, build the board + play the start sound, then hold the intro", cert: "seen" },
  0x02e1: { name: "holdRoundIntroLoop", role: "the round-start intro-hold loop — repaint the PLAYERS HUD label and a playfield strip across short frame-waits, then hand to round-loop setup", cert: "seen" },
  0x02fd: { name: "advanceToNextLevel", role: "board complete — bump the level counter, persist progress, rebuild the screen, show the bonus screen, then re-init the next (harder) round", cert: "seen" },
  0x031a: { name: "initRoundAndEnterMainLoop", role: "final per-round (re)init — run the pre-play setup chain, derive the main-loop pacing delay, clear the frame counter, then enter the main loop", cert: "seen" },
  0x0348: { name: "mainLoop", role: "the in-game / attract-demo main loop — drive one frame of game work, forever", cert: "seen" },
  0x0371: { name: "submitHighScoresAndReset", role: "game-over teardown — offer each finishing player's score to the BEST SCORES TODAY table (initials entry if it places), then reset to attract", cert: "seen" },
  0x03ac: { name: "resetStateAndShowSetup", role: "reset epilogue — begin a fresh attract cycle with no active player, commit the cabinet settings, show the setup screen, hand to the entry handler", cert: "seen" },
  0x03be: { name: "enterPlayMode", role: "switch the game into active play and seed the per-round counters", cert: "seen" },
  0x03e8: { name: "steerDemoPlayer", role: "generate the attract demo's per-frame steering — emit the one-of-four move direction (where the joystick would go) that walks the auto-played digger along the walls", cert: "seen" },
  0x0673: { name: "paintScreen", role: "lay down a whole screen — a selectable tile+colour layer from ROM, the two edge columns and the score HUD, then arm the cell-animation counter", cert: "seen" },
  0x06ac: { name: "glitterJewels", role: "cycle the colour of on-screen diamond cells so they glitter; a collected diamond drops out and holds a fixed colour", cert: "seen" },
  0x1362: { name: "seedObjectStartState", role: "drop the tracked-object / level state block back to its fixed start-of-play defaults", cert: "seen" },
  0x13c9: { name: "dispatchObjectFrameByStateTimer", role: "per-frame head of the object/state dispatcher (also the master board-transition gate) — gate on the state-lockout timer, and on its expiry vector to lose-a-life or advance-a-level", cert: "seen" },
  0x13de: { name: "advanceTrackedObject", role: "route the tracked object to its per-frame movement handler by its chain of state gates", cert: "seen" },
  0x1420: { name: "stepObjectFromControl", role: "advance the tracked object one frame from its control input (real joystick in play, demo stream in attract)", cert: "seen" },
  0x1434: { name: "advanceObjectFrame", role: "pick the tracked object's per-frame update from its mode byte and move command", cert: "seen" },
  0x144c: { name: "routeIdleObjectByMoveCommand", role: "route an at-rest object to its per-frame handler on its move-command bits", cert: "seen" },
  0x1468: { name: "windUpObjectMove", role: "settle the object's animation phase toward its move command, then run its handler", cert: "seen" },
  0x1493: { name: "stepObjectRowFlipped", role: "step the tracked object the flipped way along its move axis — derive its tile row, route on it, firing the dig one-shot at the boundary row", cert: "seen" },
  0x14cd: { name: "locateObjectCellCheckGoal", role: "locate the object's tilemap cell, latch a goal crossing if the goal is just ahead, else resolve the tile under it", cert: "seen" },
  0x1515: { name: "collectAlignedLootElseResolveTile", role: "collect a loot tile the object has landed squarely on (score + remove it), otherwise resolve how it meets the terrain", cert: "seen" },
  0x1568: { name: "resolveObjectTerrainStep", role: "resolve a moving object's step against the terrain under it — hold against a solid, push a pushable block, or walk on", cert: "seen" },
  0x1659: { name: "advanceObjectWalkFrame", role: "step a moving object's two-frame walk animation off its travel, then build its sprite record", cert: "seen" },
  0x167f: { name: "stepObjectRowUnflipped", role: "advance the tracked object along the row axis — derive its tile row, route on it, firing the dig one-shot at the trigger row", cert: "seen" },
  0x16b9: { name: "locateActorCellCheckGoal", role: "route a moving actor's horizontal step — latch the goal crossing if it reached the terminator tile, else resolve the terrain step", cert: "seen" },
  0x1704: { name: "resolveActorTerrainStep", role: "resolve a moving actor's step against terrain — collect loot in its path, hold against a wall, bump-react on a blocked diagonal, or walk on", cert: "seen" },
  0x184a: { name: "walkActor", role: "advance an actor's walk — accumulate its position, pick the walk frame, build its display record", cert: "seen" },
  0x186a: { name: "stampFixedFrameAndResolveTile", role: "stamp the actor's fixed animation frame, then run the shared cell/tile resolve tail", cert: "seen" },
  0x186f: { name: "resolveObjectTile", role: "locate the tracked object's tile cell, read the tile under it, and dispatch to the matching per-frame handler", cert: "seen" },
  0x18cf: { name: "collectLootTile", role: "collect the scoring loot tile the actor aligned onto — award points, play the pickup sound, bump that loot kind's count, blank the tile", cert: "seen" },
  0x191f: { name: "triggerDigReaction", role: "classify the tile under a digging actor and stage its carve reaction", cert: "seen" },
  0x19d0: { name: "advanceActorWalk", role: "carry an actor's walk one frame and, at the far edge, fire the Pit-crossing ship-boarding one-shot", cert: "seen" },
  0x19e3: { name: "drawActorWalkFrame", role: "commit the actor's walk frame, then fire the goal crossing's far-edge (ship-board) one-shot", cert: "seen" },
  0x1a02: { name: "stepObjectAndResolveTile", role: "step the player one frame along the climb/dig axis and resolve the tile — collect loot, carve, block, or (at the top rung with a diamond) latch board-complete", cert: "seen" },
  0x1b5b: { name: "stageObjectSpriteRecord", role: "build the object's 4-byte sprite record in the staging buffer, biasing its ends", cert: "seen" },
  0x23e8: { name: "seedMountainErosion", role: "seed the mountain-erosion write pointer + its level-scaled countdown (erosion runs faster every level), then cue a sound and stamp the tilemap cap", cert: "seen" },
  0x241c: { name: "erodeMountain", role: "one frame-gated step of mountain erosion — walk a write pointer down the mountain column (writing tile 0x31) as it visibly eats away, and on the escape case drop the rescue ship", cert: "seen" },
  0x24cf: { name: "resetReactionState", role: "reset the per-object reaction state machine to idle and seed its companion bytes at round start", cert: "seen" },
  0x24f3: { name: "advancePlayerLaser", role: "fire/advance the player's horizontal laser (and the dig/push carve reaction it shares a slot with); kicks off the per-frame actor chain", cert: "seen" },
  0x287a: { name: "seedDigObjectBlock", role: "seed the dig/target object control block at round start (resting hazard type = arrow)", cert: "seen" },
  0x28ab: { name: "spawnDigEntity", role: "stage a dig entity at the actor's aligned tilemap cell and commit it the first pass the spawn slot is free", cert: "seen" },
  0x2934: { name: "commitDigEntity", role: "commit one dig entity into its tilemap cell and patch the neighbouring cells", cert: "seen" },
  0x29ad: { name: "advanceDigCarveObject", role: "per-frame driver for the dig/carve object that tunnels the maze — spawn gate, capture hand-off, carve countdown, and tile carving", cert: "seen" },
  0x2bd3: { name: "stageDigObjectSpriteRecord", role: "compose the falling-hazard / dig object's sprite record so it draws at its cell (shape from state, colour from type)", cert: "seen" },
  0x2bf2: { name: "startNextDigSpawn", role: "start the next queued dig-object spawn, or clear the spawn-active flag when nothing is queued", cert: "seen" },
  0x2c04: { name: "spawnPendingDigObject", role: "pop a random queued column and spawn a falling dig/hazard object there (a rock/arrow that then falls)", cert: "seen" },
  0x2c91: { name: "flagObjectTargetOverlap", role: "flag whether the freshly-placed target cell coincides with the tracked object, then build the cell's record", cert: "seen" },
  0x2cb7: { name: "captureTargetOnOverlap", role: "tick the dig target's countdown and, on expiry, snap the tracked object onto the target when it overlaps, marking it captured", cert: "seen" },
  0x2d06: { name: "advanceDigTarget", role: "advance the dig target a step and route on the tile it now covers — embed it into terrain on solid ground, else re-stage its sprite", cert: "seen" },
  0x2d4e: { name: "landDigTarget", role: "land the descending dig/capture target when it reaches terrain — stamp the wall tile, request the dig sound, reset its state block", cert: "seen" },
  0x2d6b: { name: "stampGlyphColumn", role: "stamp the fixed five-tile ZONK!! popup glyph down the object's column, colour it, re-arm the state timer, then continue the background update", cert: "seen" },
  0x2f2f: { name: "seedChamberCreature", role: "seed the left-chamber creature + Pit floor-reveal parameters (first block of round setup), derive the reveal period, then seed the enemy records", cert: "seen" },
  0x2f71: { name: "advanceChamberCreature", role: "per-frame driver for the left-chamber creature — bounce it sideways, accelerate its fall-Y to the floor + RNG-reset, cycle its frame, publish its sprite, and (once the goal latch is set) dissolve one more Pit floor-reveal column", cert: "seen" },
  0x2f88: { name: "revealTerrainColumn", role: "reveal the next column of the Pit sliding-floor backdrop on its frame gate, then continue the background phase clock", cert: "seen" },
  0x2fb7: { name: "drawTerrainColumn", role: "write one vertical strip of backdrop tiles up a column, then tick the animation clock", cert: "seen" },
  0x2fc0: { name: "advanceChamberCreatureAnimation", role: "the chamber creature's sprite-flip phase clock — tick the phase countdown and route to the flip / position-step / publish continuation", cert: "seen" },
  0x2fd9: { name: "setChamberCreatureFrame", role: "commit the chosen chamber-creature flip tile, then continue the shared animation tail", cert: "seen" },
  0x2fe3: { name: "oscillateChamberCreature", role: "step the chamber creature's position on an on-beat frame — horizontal bounce + accelerating fall-Y to the floor + RNG-reset, then publish", cert: "seen" },
  0x3029: { name: "publishChamberCreatureSprite", role: "write the chamber creature's four screen-relative sprite bytes into its staging slot, then hand off to the object-record pass", cert: "seen" },
  0x30de: { name: "seedEnemyRecords", role: "seed the enemy records (second block of round setup) and derive the difficulty-scaled enemy-speed pair (0x07 − (level&6) → 7,5,3,1)", cert: "seen" },
  0x312d: { name: "updateEnemy1", role: "per-frame enemy pass — drive enemy 1 through the shared move/collision driver, stage its sprite, then hand off enemy 2", cert: "seen" },
  0x316f: { name: "updateEnemy2", role: "advance enemy 2 one frame through the shared driver and stage its sprite", cert: "seen" },
  0x319d: { name: "stepEnemyMover", role: "per-frame step for one enemy/mover — arrival, laser/player collision, retarget, and steer into a travel-direction preset (the maze-follower AI)", cert: "seen" },
  0x33bc: { name: "tileInProbeRow", role: "is the tile at an enemy's probe cell listed in this phase's probe-table row? (a can-step-this-way gate)", cert: "seen" },
  0x33da: { name: "probeRowBackTilePair", role: "probe two phase-keyed ROM tables for the tile one memory-row back from the enemy's probe cell", cert: "seen" },
  0x3410: { name: "nextTileInProbeRow", role: "one of four sibling table searches the mover AI uses to decide whether a move in a given direction is allowed", cert: "seen" },
  0x3425: { name: "probeRowAheadTilePair", role: "two-stage table probe — does the tile one memory-row ahead of the enemy's cell (and, conditionally, its neighbour) belong to this phase's table rows?", cert: "seen" },
  0x3458: { name: "tickObjectDwellThenTransition", role: "tick the enemy-catch dwell countdown; blink the sprite while it runs and, on expiry, hand off to lose-a-life (the enemy-contact death)", cert: "seen" },
  0x3476: { name: "stepMoverUp", role: "one fixed-direction preset of the patrol mover — step its position and, on the cadence beat, republish this preset's travel direction", cert: "seen" },
  0x347d: { name: "stepMoverMirrored", role: "advance one mover step for movement direction 1 — step position on the cadence beat and refresh facing + walk-frame", cert: "seen" },
  0x3484: { name: "stepMoverDown", role: "one fixed-direction preset of the patrol mover — step its position and re-publish this preset's facing on the cadence beat", cert: "seen" },
  0x348b: { name: "stepMoverUnmirrored", role: "advance one mover step for movement direction 3 — step position on the cadence beat and refresh facing + walk-frame", cert: "seen" },
  0x34da: { name: "advanceDormantMover", role: "mover housekeeping — advance two cadence counters, and on the slow wrap free-run a shot enemy toward respawn", cert: "seen" },
  0x34f0: { name: "reseedMoverCadenceAndRearmState", role: "periodic mover refresh — reseed the random/animation byte and re-arm the actor state byte", cert: "seen" },
  0x36fe: { name: "seedActorSpawnState", role: "put the two-sprite actor (primary + twin) into its fixed starting state and drop it back to the un-spawned phase", cert: "seen" },
  0x3748: { name: "advanceTwoSpriteActor", role: "per-frame update for the two-sprite actor (enemy-3 / rescue-ship / intro set-piece) — dispatch by spawn state and animation phase, marching + walk-animating it inline", cert: "seen" },
  0x37cf: { name: "spawnAltPhaseActor", role: "bring the alt-phase two-sprite actor to life on its first frame, then animate it every frame after", cert: "seen" },
  0x384a: { name: "advanceAltPhaseActor", role: "per-frame animate + march for the alt-phase actor — the rescue ship flying in to land on the escape path (→ level advance)", cert: "seen" },
  0x38c8: { name: "advanceOrRebuildTwinActor", role: "per-frame gate for the two-body actor — keep it moving while high in the field, else rebuild it at the start edge and redraw (which specific figure is unpinned)", cert: "seen" },
  0x3945: { name: "paceActorCadence", role: "cadence front end for the actor phase body — tick the period-8 timer down, reload it on expiry, then run the phase body", cert: "seen" },
  0x3968: { name: "easeActorToRest", role: "per-frame coordinate stepper — ease an actor's coordinate down to a resting floor and keep its shadow twin a fixed 16 ahead", cert: "seen" },
  0x3984: { name: "spawnTwinActor", role: "spawn the two-body actor once its spawn is due — paint its tile+colour figure, seed both records, stage its sprite records", cert: "seen" },
  0x3a13: { name: "advanceActorMovers", role: "advance the two-sprite actor (live enemy-3) through the shared move/collision driver, then stage its sprite records", cert: "seen" },
  0x3a4c: { name: "stageActorSpriteRecords", role: "stage the current actor's two hardware sprite records (main body + shadow twin) into the sprite buffer", cert: "seen" },
  0x3a6f: { name: "showSetupScreen", role: "paint the round-setup screen (playfield furniture + two HUD count records) and hold it briefly while a colour band cycles", cert: "seen" },
  0x3b81: { name: "showFixedScreen", role: "paint a canned full-screen ROM image and hold it briefly", cert: "seen" },
  0x3ba8: { name: "holdFixedScreen", role: "paint a canned full-screen ROM image, then hold it on display forever", cert: "seen" },
  0x3bec: { name: "showBonusScreen", role: "paint the tier-selected board-complete bonus screen (5000 / 10000 / 15000) and hold it while it tallies with sound + colour cycling", cert: "seen" },
  0x3cc1: { name: "drawSharedPanel", role: "lay out a fixed panel — the left edge column, both players' score HUD, three labelled tile/colour runs, then the right edge and playfield columns", cert: "seen" },
  0x3d49: { name: "drawSetupCreditsPanel", role: "paint one fixed 9-cell HUD/text panel at column 1, row 12", cert: "seen" },
  0x3d7e: { name: "cycleStagedColumnColour", role: "advance the board-mode byte (keeping bit 3 clear), then paint it down a column of cells", cert: "seen" },
  0x3d8a: { name: "drawGameOverText", role: "paint one fixed 9-cell vertical text strip at column 6, row 12", cert: "seen" },
  0x3dae: { name: "rowColToTileOffset", role: "turn a (row, column) tile-cell into a linear tilemap offset", cert: "seen" },
  0x3dc9: { name: "deriveTileWriteCursors", role: "turn a tile's tilemap offset into its colour-RAM and video-RAM write cursors", cert: "seen" },
  0x3ddb: { name: "copyCappedTileColumn", role: "copy a tile-code run down a video-RAM column, capping the top cell", cert: "seen" },
  0x3dea: { name: "copyTileColumn", role: "copy a stored run of tile codes straight down a video-RAM column", cert: "seen" },
  0x3e01: { name: "fillColourColumn", role: "paint a vertical run of colour-RAM cells with one colour byte", cert: "seen" },
  0x3e13: { name: "cycleColumnColour", role: "advance the shared colour index and repaint one screen column with it", cert: "seen" },
  0x3e1d: { name: "fillColourColumnAt", role: "paint a full-height colour-RAM column with one colour", cert: "seen" },
  0x4632: { name: "saveActivePlayerRecord", role: "copy the live working game record into the backup slot of the player whose turn it is, so progress survives the turn switch", cert: "seen" },
  0x4644: { name: "loadPlayerState", role: "make the selected player's saved level/score the current live state", cert: "seen" },
  0x4673: { name: "awardOnePoint", role: "add one point to the active player's score (with its pickup sound) and repaint the digits", cert: "seen" },
  0x467b: { name: "awardTenPoints", role: "add 10 to the active player's score (with its sound) and repaint the digits", cert: "seen" },
  0x4683: { name: "awardTwentyPoints", role: "add 20 to the active player's score (with its sound) and repaint the digits", cert: "seen" },
  0x4689: { name: "addScore", role: "the shared scorer — fold a packed-BCD increment into the active player's two-byte score (with carry) and repaint the on-screen digits", cert: "seen" },
  0x46af: { name: "drawScoreDigits", role: "repaint the active player's on-screen score digits", cert: "seen" },
  0x46f4: { name: "drawLeftEdgeColumn", role: "stamp the fixed playfield left-edge column (a 32-tile picture strip) and tint it", cert: "seen" },
  0x472c: { name: "redrawScoreHud", role: "repaint both players' score displays, draw the status label, and tint the two HUD colour columns", cert: "seen" },
  0x4785: { name: "drawBestScoresTodayLabel", role: "stamp a fixed edge column, then hand to the colour fill to tint it", cert: "seen" },
  0x47a1: { name: "drawRightEdgeColumn", role: "draw the rightmost playfield column (a 28-tile strip) with its base colour and three accents", cert: "seen" },
  0x47e1: { name: "drawPlayerLabel", role: "paint the fixed PLAYER panel (tile column + matching colour column) at screen column 1, row 12", cert: "seen" },
  0x4816: { name: "paintPlayfieldStripCol1Row11", role: "paint one fixed vertical tile strip of the round's static playfield and its matching colour column", cert: "seen" },
  0x483a: { name: "drawMenLeftPanel", role: "paint the lives-remaining HUD panel at column 5, in one of two variants", cert: "seen" },
  0x4894: { name: "drawCreditsDisplay", role: "paint the fixed 9-cell credits HUD panel at column 6, row 10", cert: "seen" },
  0x48c4: { name: "cyclePanelColumnColour", role: "recolour a fixed nine-cell colour-RAM column, cycling its colour one step each call", cert: "seen" },
  0x48e5: { name: "drawGameOverLabel", role: "stamp the nine-character GAME OVER label down its HUD text column", cert: "seen" },
  0x492a: { name: "drawCopyrightLine", role: "paint one 32-tile screen column (the copyright line), then colour it", cert: "seen" },
  0x4b10: { name: "disableFrameInterrupt", role: "switch the per-frame (vblank) interrupt off", cert: "seen" },
  0x4b14: { name: "enableNmi", role: "switch on the per-frame vblank interrupt (the NMI mask)", cert: "seen" },
  0x4b1a: { name: "advanceRandom", role: "step the 16-bit LFSR pseudo-random generator and return a fresh byte", cert: "seen" },
  0x4b3c: { name: "setupBoardModeC0", role: "the mode-0xC0 door into the shared display-setup body — stow the mode byte and rebuild the screen", cert: "seen" },
  0x4b40: { name: "setupBoardMode90", role: "the mode-0x90 door into the shared display-setup body — stow the mode byte and rebuild the screen", cert: "seen" },
  0x4b44: { name: "blankScreen", role: "the mode-0 door into the shared display-setup body — stow mode 0 and blank the whole screen", cert: "seen" },
  0x4b46: { name: "setupBoardDisplay", role: "record the board-mode byte and rebuild the whole screen for it (clear sprites, wipe tilemap, flood colour RAM)", cert: "seen" },
  0x4b55: { name: "applyDipSwitches", role: "read the cabinet DIP switches and commit them to runtime config — coin costs, difficulty/lives, and the flip-screen/cocktail lines", cert: "seen" },
  0x4bc7: { name: "initScoreDisplay", role: "blank the numeric-readout strip, seed three zeroed readout records, then render them", cert: "seen" },
  0x4bea: { name: "resetScoreAndSoundQueue", role: "blank the score bytes and the sound-command queue back to zero", cert: "seen" },
  0x4bff: { name: "waitFrames", role: "pause for a fixed number of video frames, then return", cert: "seen" },
  0x4c11: { name: "clearSpriteAndAttributeRam", role: "wipe sprite RAM and the per-column scroll for a clean screen at setup", cert: "seen" },
  0x4c1c: { name: "clearSpriteStagingBuffer", role: "zero the sprite-staging block during setup", cert: "seen" },
  0x4c27: { name: "fillVideoRam", role: "paint every cell of the tilemap with one tile code", cert: "seen" },
  0x4c37: { name: "fillColorRam", role: "repaint every colour-RAM cell with one board-mode colour byte", cert: "seen" },
  0x4c47: { name: "disableSound", role: "pull the sound-enable line low, silencing the audio", cert: "seen" },
  0x4c4d: { name: "enableSound", role: "switch the master sound-enable line on (unmute the audio)", cert: "seen" },
  0x4c57: { name: "requestSound2", role: "enqueue sound-command 2", cert: "seen" },
  0x4c5b: { name: "requestSound3", role: "enqueue the coin sound (command 3)", cert: "seen" },
  0x4c5f: { name: "requestSound4", role: "enqueue the game-start sound (command 4)", cert: "seen" },
  0x4c63: { name: "requestSound5", role: "enqueue sound-command 5", cert: "seen" },
  0x4c67: { name: "requestSound6", role: "enqueue the board-start / advance sound (command 6)", cert: "seen" },
  0x4c6b: { name: "requestSound7", role: "enqueue the mountain-gone sound (command 7)", cert: "seen" },
  0x4c6f: { name: "requestSound8", role: "enqueue the initials-step sound (command 8)", cert: "seen" },
  0x4c73: { name: "requestSound9", role: "enqueue sound-command 9", cert: "seen" },
  0x4c77: { name: "requestSound10", role: "enqueue sound-command 10", cert: "seen" },
  0x4c7b: { name: "requestSound11", role: "enqueue the Pit floor-reveal sound (command 11)", cert: "seen" },
  0x4c7f: { name: "requestSound12", role: "enqueue sound-command 12", cert: "seen" },
  0x4c83: { name: "requestSound13", role: "enqueue the +1 pickup sound (command 13)", cert: "code" },
  0x4c8b: { name: "requestSound15", role: "enqueue sound-command 15", cert: "seen" },
  0x4c8f: { name: "requestSound16", role: "enqueue the crystal / jewel-collect flourish (command 16)", cert: "seen" },
  0x4c93: { name: "requestSound17", role: "enqueue the treasure-capture sound (command 17)", cert: "seen" },
  0x4c97: { name: "requestSound18", role: "enqueue the jewel-collect flourish variant (command 18)", cert: "seen" },
  0x4c9b: { name: "requestSound19", role: "enqueue the dig-descend sound (command 19)", cert: "seen" },
  0x4c9f: { name: "requestSound20", role: "enqueue the dig-carve sound (command 20)", cert: "seen" },
  0x4ca3: { name: "requestSound21", role: "enqueue sound-command 21", cert: "seen" },
  0x4ca5: { name: "enqueueSoundCommand", role: "append one sound request (OR'd with bit 7) to the 8-slot sound ring buffer", cert: "seen" },
  0x4cbf: { name: "submitPlayerHighScore", role: "offer the finishing player's final score to the BEST SCORES TODAY table and repaint the readouts", cert: "seen" },
  0x4cca: { name: "renderScoreReadouts", role: "lay the three high-score readout numbers into their on-screen display cells", cert: "seen" },
  0x4d0c: { name: "unpackScoreDigits", role: "expand a staged packed score value into display digit cells", cert: "seen" },
  0x4d3a: { name: "insertHighScore", role: "place a candidate score into the descending three-entry BEST SCORES TODAY table, bumping the entries it beats down a rank", cert: "seen" },
  0x4df8: { name: "runHighScoreInitialsEntry", role: "the high-score initials-entry screen — build the display, let the player dial in three initials, then show the final readouts", cert: "seen" },
  0x4eea: { name: "stepHighScoreInitialsEntry", role: "per-frame initials-entry handler — step the current letter up/down and commit on Fire, keyed on the debounced input", cert: "seen" },
  0x4f26: { name: "stepInitialDown", role: "step the initials letter down one notch (clamping at the top) and play the step sound", cert: "seen" },
  0x4f38: { name: "advanceInitialUp", role: "step the initials letter up one notch (rolling over at the bottom) and play the step sound", cert: "seen" },
  0x4f47: { name: "showColourTestScreen", role: "the DIP-selected colour/tile test-pattern screen", cert: "seen" },
};
