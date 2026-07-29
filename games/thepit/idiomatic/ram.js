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
 *  spawns). Grounded (§2.10). (strong) */
export const PLAYER_Y = 0x8068;

/** Player X (game-space) — work-X at 0x806b, paired with PLAYER_Y; renders screen-VERTICAL under ROT270
 *  (dig-mode drives the player DOWN the screen while PLAYER_X increases, §2.10). Drives the tilemap COLUMN
 *  index (col = (PLAYER_X-bias+5)>>3). Used across 17 routines. Grounded (§2.10). (strong) */
export const PLAYER_X = 0x806b;

/** Tile-cell COLUMN byte fed to the (row,col)→tilemap-offset calc (rowColToTileOffset-style). Paired with
 *  TILE_ROW; both written by the fill/stamp setup (loc_4e1b/loc_4e55). (fair) */
export const TILE_COL = 0x8058;

/** Tile-cell ROW byte fed to the tilemap-offset calc; paired with TILE_COL (loc_4e20/loc_4e5a). (fair) */
export const TILE_ROW = 0x8059;

/** 16-bit pointer to the actor's current video-RAM display cell (loaded into IX via `ld ix,(0x806e)`
 *  by the draw/dispatch code loc_174f/loc_1a66). (strong) */
export const PLAYER_CELL_PTR = 0x806e;

// ── Player facing / sprite frame ──────────────────────────────────────────────

/** Player facing + sprite-frame code (`ld (0x8069),a` with 0x32/0x33/0xb2/0xb3, bit7 = horizontal
 *  mirror; also 0x34/0xb4/0x35 anim frames). When facing is horizontal this **selects the laser
 *  direction** (§2.3, grounding forced 0x8069=0x32 to fire a rightward bolt). Used across 19 routines.
 *  Grounded (§2.2/§2.3). (strong) */
export const PLAYER_FACING = 0x8069;

// ── Game state / round ────────────────────────────────────────────────────────

/** Game state — 0 attract · 1 one-player game · 2 two-player · 3 credit-standby · 4 attract-demo.
 *  The input select reads the real joystick at states 0-2 and the synthetic demo stream at ≥3 (§2.1).
 *  Grounded (§2.1: coin→start→play pinned 0x8001 3→1 at f464). Used across 17 routines. (strong) */
export const GAME_STATE = 0x8001;

/** Active player index (1 or 2) — armed alongside GAME_STATE (loc_038b/loc_03b2 `(0x8002)=1/2`) and
 *  read on the P1↔P2 handoff. (fair) */
export const ACTIVE_PLAYER = 0x8002;

/** Board/entry-select mode byte — the value the multi-door entry family stows before the shared body
 *  (setupBoardMode90/blankScreen/setupBoardDisplay "entry-selected byte", "mode/variant"). Used across 17 routines. (fair) */
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

/** MOVE_BLOCK_FLAG (0x8080) — movement blocker. A falling rock/arrow overlapping the player sets it
 *  (`loc_2c04`), and the vertical/climb routine `loc_1a02` bails to its epilogue while it is nonzero —
 *  so hazards **freeze movement, they do not kill** (§2.5, grounded). (The earlier "climb gate" reading
 *  was refuted; it is a pure blocker.) (fair) */
export const MOVE_BLOCK_FLAG = 0x8080;

// ── Enemy #3 — a 2-sprite actor (primary 0x810a + twin 0x811b), NOT a "ship" (§2.7, grounded) ──
// One hardware slot, THREE grounded uses (G.17): (1) live enemy #3, a roaming rival explorer that is
// shootable like enemies 1&2 (loc_3a13 during 0x8010≥0x0a); (2) the board-intro set-piece — it flies
// the saucer + Zonker tank into place, which are then baked into the background tilemap and the sprite
// freed; (3) the escape rescue-ship when the mountain is gone (loc_384a → level advance).
// Structurally the primary (0x810a..) and its mirrored twin (0x811b.., locked +16px) compose one
// ~32px-tall actor rendered together by stageActorSpriteRecords. Distinct from the PLAYER (PLAYER_Y/PLAYER_X path).

export const ENEMY3_X = 0x810a; // primary half: X (fair)
export const ENEMY3_TILE = 0x810b; // primary half: sprite/tile field (fair)
export const ENEMY3_Y = 0x810d; // primary half: Y (fair)
export const ENEMY3_TWIN_X = 0x811b; // twin half: X, locked +16 to ENEMY3_X (fair)
export const ENEMY3_TWIN_TILE = 0x811c; // twin half: sprite/tile field (fair)
export const ENEMY3_TWIN_Y = 0x811e; // twin half: Y (record offset +3) (fair)

/** BOARD_END_PHASE (0x807b) — end-of-board state read when the mountain is gone (§2.6): 0 = idle
 *  (pure-idle case, just plays a sound), 1 = ESCAPE (player reached the top rung with treasure → forces
 *  the rescue ship down → level advance), ≥2 = done. Also gates enemy-3's alt spawn path (loc_3748).
 *  Grounded (§2.6). (fair) */
export const BOARD_END_PHASE = 0x807b;

/** Enemy-3 cadence timer (record offset 8, 0x810a+8) — reloaded and counted down to pace enemy #3
 *  (loc_3800/loc_38f6/loc_3786). (fair) */
export const ENEMY3_TIMER = 0x8112;

/** Enemy work-slot sprite/state byte (0x8083+1) — the sprite/orientation code of whichever enemy is
 *  currently ldir'd into the shared work slot; the enemy-catch sets it to 0x17 (§2.4). Re-armed by the
 *  mover epilogue (loc_34fa/loc_34cf). (fair) */
export const ENEMY_WORK_SPRITE = 0x8084;

// ── Free-running counters ─────────────────────────────────────────────────────

/** ENEMY_ACTION_TIMER (0x808b) — mover-record offset 8: a decrementing cadence/dwell timer every mover
 *  routine drives (stepEnemyMover dwell/respawn countdown; stepMoverUp/stepMoverDown/stepMoverMirrored/stepMoverUnmirrored per-step cadence),
 *  parallel to ENEMY1_TIMER/ENEMY2_TIMER. (The earlier "random/animation" reading is refuted.) (weak) */
export const ENEMY_ACTION_TIMER = 0x808b;

/** PLAY_PHASE_COUNTER (0x8010) — the board-startup ramp: cleared to 0 at reset/board rebuild, then
 *  ramped up as the intro stages into live play. A master gate — enemies 1&2 don't run until ≥8, enemy-3
 *  goes live and mountain erosion advances at ≥0x0a (live play consistently begins ~f1180). Also read by
 *  steerDemoPlayer's 30-frame gate. Grounded (§2.1). (strong) */
export const PLAY_PHASE_COUNTER = 0x8010;

// ── Sound ─────────────────────────────────────────────────────────────────────

/** Sound-command ring HEAD index (mod 8) — advanced by the shared enqueue tail enqueueSoundCommand
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

// ── Input debounce (the NMI serviceVblankNmi samples + debounces the two ports) ───────
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
 *  both strong: init=1 (startGame), inc (advanceToNextLevel), scaled in seedMountainErosion/initRoundAndEnterMainLoop/seedZonker. (strong) */
export const LEVEL = 0x8028;

// ── Shared tile/colour column-plotter parameter block (0x8055-0x8060) ─────────
/** Run length for the shared column plotter — how many cells the copy/fill helpers
 *  (copyTileColumn/copyCappedTileColumn/fillColourColumn) paint straight down a map column (djnz count,
 *  stride 0x20 = one screen row). Staged by ~18 painter routines before each draw call.
 *  Proposer≠confirmer converged, both strong. Sits beside TILE_COL/TILE_ROW. (strong) */
export const PLOT_RUN_LENGTH = 0x8055;

// ── Falling hazards (rock / arrow) ────────────────────────────────────────────
/** HAZARD_ACTIVE_COUNT (0x80bd) — number of falling hazards (rocks/arrows) currently live: 0 = none.
 *  The first-diamond award is gated on this being 0 (§2.8), and it bounds the drop machinery. Bumped
 *  when a hazard spawns, decremented as they retire, cleared on reset/boundary. Grounded (§2.5/§2.8). (fair) */
export const HAZARD_ACTIVE_COUNT = 0x80bd;

// ── Laser + shared reaction/laser sprite slot (0x8094-0x80a4, time-multiplexed; §2.3) ─
/** LASER_STATE (0x80a1) — laser-bolt state, laser-specific within the shared slot: 0 = ready,
 *  +8 (0x08) = flying right, 0xf8 (−8) = flying left, 1 = spent. Set on fire (input 0x8018 bit4 +
 *  horizontal PLAYER_FACING), stepped by the flight routine, cleared to 0 when fire is released so the
 *  next press re-arms — one bolt in flight at a time. Grounded (§2.3, grounding-2 Z-7). (strong) */
export const LASER_STATE = 0x80a1;

/** Per-object reaction/animation state selector: 0 = idle (normal per-frame movement runs),
 *  1-4 = a specific collision/dig/push reaction is armed + playing; also a busy-lock that
 *  defers the normal frame. Armed to 1-4 by locateObjectCellCheckGoal/collectAlignedLootElseResolveTile/resolveObjectTerrainStep/resolveActorTerrainStep/triggerDigReaction, dispatched by
 *  advancePlayerLaser, deferred by stepObjectFromControl, render-Y-biased at ==4. Proposer≠confirmer converged,
 *  both strong. (strong) */
export const REACTION_STATE = 0x80a2;

// ── Under-tile latches (the classify ladder records these when the tracked object aligns
//    on a special tile: 0x27 -> GOAL_TILE_LATCH, 0x26 -> PRIZE_GATE) ──────────────
/** Latch set when the tracked object REACHES the special goal tile 0x27 (once past column
 *  0x53); tested nonzero to reroute state dispatch to the goal handler and enable the terrain
 *  scroll-reveal; cleared at init and on retreat (col < 0x53). Proposer≠confirmer converged on
 *  role (names MARKER/GOAL, confidence strong/fair). (fair) */
export const GOAL_TILE_LATCH = 0x80e7;
/** Latch set when the object's under-tile == 0x26 — a DISTINCT field from GOAL_TILE_LATCH's
 *  0x27 (the shared classify ladder resolveObjectTerrainStep records both adjacently, which is why the two
 *  look twinned). Gates the 0x3b-0x3d feature path (collectLootTile) and is cleared by a boundary
 *  one-shot (stepObjectRowUnflipped/stepObjectRowFlipped, alongside HAZARD_ACTIVE_COUNT). NOT part of the 0x27 goal path.
 *  The 0x26 feature cell is the PREREQUISITE that unlocks the +20 diamond pickup
 *  (TREASURE_COLLECTED 0x8078); verified vs collectLootTile, resolveActorTerrainStep.
 *  ★ Proposer≠confirmer BOTH converged on the wrong tile (0x27); the adversarial review
 *  corrected it to 0x26 — why the third review is load-bearing even after convergence. (fair) */
export const PRIZE_GATE = 0x8076;

// ── Naming batch 2 (proposer≠confirmer, all 6 converged) ──────────────────────
/** Reaction step/animation countdown for the REACTION_STATE machine: reloaded from the period
 *  byte 0x80a3 when a reaction (1-4) is armed, decremented per frame by advancePlayerLaser, and on zero
 *  ends the reaction (clears REACTION_STATE); the value 0x18 also cues a sound. (strong) */
export const REACTION_TIMER = 0x80a4;
/** HAZARD_X (0x80a9) — X of the falling-hazard / dig-carve target cell (>>3 -> tile column); this ONE
 *  record is shared between a falling rock/arrow and the dig-carve target-capture (loc_29ad drives both).
 *  Paired with HAZARD_Y, bbox-compared against the player for capture, folded into the VRAM cell address.
 *  (strong) */
export const HAZARD_X = 0x80a9;
/** HAZARD_Y (0x80ac) — Y of the same record; when a hazard is falling it advances +1/frame (§2.5).
 *  Paired with HAZARD_X. (fair — the X/Y label is rotation-dependent but consistently pairs.) (fair) */
export const HAZARD_Y = 0x80ac;
/** HAZARD_STATE (0x80aa) — state/phase of the falling-hazard / dig-carve object: 0x10 = falling/spawn,
 *  0x30 = resting/carving, 0x09 = done/target (§2.5). Branched on by advanceDigCarveObject, copied into
 *  the sprite record. (fair) */
export const HAZARD_STATE = 0x80aa;
/** PIT_CROSS_ACTIVE (0x8077, sticky) — the Pit-crossing flag: set when the player reaches goal tile
 *  0x27 (past column 0x53); it gates boarding the ship at the far edge (col ≥ 0x8a, loc_19d0/19e3) and
 *  disables the laser while crossing. The cross itself awards no points (§2.5, grounding-2 Z-5). (fair) */
export const PIT_CROSS_ACTIVE = 0x8077;
/** Fixed DSW/cabinet-derived pixel offset (0 in normal play) biased into sprite coordinates;
 *  computed once by the DSW decode applyDipSwitches. (strong) */
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
 *  0/0xff presence role across 6 routines. (strong) */
export const PLAYER_ACTIVE = 0x8079;

/** TRANSITION_TIMER (0x807c) — the MASTER board-transition countdown (§2.9). Each frame the player
 *  dispatcher (loc_13c9) decrements it and defers normal processing while it runs; on expiry it reads
 *  POST_TRANSITION_MODE 0x807d and vectors to EITHER lose-a-life OR advance-a-level. Armed to a duration
 *  at events (0x78 idle-arm; 0xb4 on reboard/boundary latch). Grounded directly (§2.9, tape_transition:
 *  0x807c 8→0 drove level 1→2 with mode=1, or lives 3→2 with mode=0). (strong) */
export const TRANSITION_TIMER = 0x807c;

/** POST_TRANSITION_MODE (0x807d) — the death-vs-advance selector read when TRANSITION_TIMER expires:
 *  0 → lose a life (loc_0278, MEN_LEFT--); 1 → advance a level (loc_02fd, LEVEL++ + board-complete bonus).
 *  Set to 1 by the escape/reboard actors (ship-landing loc_384a, pit-cross reboard), left/forced 0 by the
 *  enemy-catch and bare-timer paths. Grounded (§2.9). (strong) */
export const POST_TRANSITION_MODE = 0x807d;

// ── Named by the adversarial RAM-naming pass: proposer≠confirmer + an independent judge,
//    by cross-routine consensus, keep-hex-if-ungrounded. Unlike the older names above,
//    these DID get the adversarial re-derivation. Tag (fair): grounded + cross-checked,
//    not yet pixel-verified — the pixel gate stays the correctness authority, not the name.

// ── Score (packed-BCD) + high-score display staging ──
/**
 *  SCORE_LO (0x8031) — Low packed-BCD byte of the active player's 2-byte score; BCD-added by
 *  awardTwentyPoints/addScore, split to digits by drawScoreDigits, read as hiscore candidate by insertHighScore, cleared
 *  by resetScoreAndSoundQueue -- four independent users. (fair)
 */
export const SCORE_LO = 0x8031;
/**
 *  SCORE_HI (0x8034) — High packed-BCD byte of the active score paired with 0x8031, same four
 *  routines (addScore carry target, drawScoreDigits render with leading-zero blank, insertHighScore
 *  candidate, resetScoreAndSoundQueue clear). (fair)
 */
export const SCORE_HI = 0x8034;
/**
 *  SCORE_DISPLAY_LOW (0x8037) — Low byte of the 16-bit score value staged by renderScoreReadouts per
 *  high-score record and unpacked into digit tiles by unpackScoreDigits/unpackScoreDigits. (fair)
 */
export const SCORE_DISPLAY_LOW = 0x8037;
/**
 *  SCORE_DISPLAY_HIGH (0x8038) — High byte of the 16-bit score value staged at 0x8037 for the
 *  digit unpacker; written by renderScoreReadouts, read MSB-first by unpackScoreDigits. (fair)
 */
export const SCORE_DISPLAY_HIGH = 0x8038;

// ── Tilemap write geometry + wait/glitter/step timers ──
/**
 *  FRAME_WAIT_COUNTDOWN (0x8009) — Per-frame countdown decremented each frame by the vblank
 *  NMI (serviceVblankNmi ld/dec/ld) and armed+busy-waited to 0 by waitFrames/waitFrames; both namers
 *  and my derivation agree, grounded in two independent routines. (fair)
 */
export const FRAME_WAIT_COUNTDOWN = 0x8009;
/**
 *  STEP_TIMER_BASE (0x804f) — DSW-decoded base (applyDipSwitches) that seeds the step timer 0x8067 =
 *  0x804f - 4*LEVEL (seedMountainErosion); 0x8067 is the per-step countdown erodeMountain decrements each
 *  frame. (fair)
 */
export const STEP_TIMER_BASE = 0x804f;
/**
 *  TILEMAP_OFFSET (0x805a) — 16-bit tilemap offset 32*row+col computed by rowColToTileOffset from
 *  0x8059/0x8058 and consumed by deriveTileWriteCursors to derive colour/video cursors; shared across ~10
 *  painter routines, both converged. (fair)
 */
export const TILEMAP_OFFSET = 0x805a;
/**
 *  GLITTER_COUNTDOWN (0x805c) — Free-running 8->1 (reload 8) per-frame countdown that
 *  glitterJewels uses to pace the diamond-glitter cell recolour, armed to 1 by
 *  paintScreen/paintScreen; role behaviorally pinned, both converged. (fair)
 */
export const GLITTER_COUNTDOWN = 0x805c;
/**
 *  COLOUR_RAM_CURSOR (0x805e) — 16-bit colour-RAM write cursor = tilemap offset + 0x8800
 *  colour base, stored by deriveTileWriteCursors (paired with the 0x8060 video cursor) and walked down-
 *  column by the fillers fillColourColumn/cyclePanelColumnColour/etc across ~10 routines. (fair)
 */
export const COLOUR_RAM_CURSOR = 0x805e;
/**
 *  MOUNTAIN_ERODE_PTR (0x8065) — 16-bit VRAM write cursor for the mountain erosion (§2.6): seeded
 *  0x9104 by seedMountainErosion, deref'd via IX and walked +0x20/step down the mountain column (writing
 *  tile 0x31) by erodeMountain as the mountain visibly eats away. Grounded (§2.6). (fair) */
export const MOUNTAIN_ERODE_PTR = 0x8065;
/**
 *  MOUNTAIN_ERODE_TIMER (0x8067) — per-step countdown pacing the erosion: armed level-scaled
 *  (diffBase 0x804f − 4*LEVEL, so erosion runs faster every level) by seedMountainErosion, decremented each
 *  frame by erodeMountain which advances one step only on expiry. Grounded (§2.6). (fair) */
export const MOUNTAIN_ERODE_TIMER = 0x8067;

// ── Tracked-object tile cell + sprite attribute ──
/**
 *  PLAYER_SPRITE_ATTR (0x806a) — object sprite attribute byte (palette bits0-2 + priority bit3):
 *  seeded 2 by seedObjectStartState, copied by stageObjectSpriteRecord into sprite-record byte+2 (0x8222) which video.js
 *  decodes as color and priority (fair)
 */
export const PLAYER_SPRITE_ATTR = 0x806a;
/**
 *  PLAYER_TILE_COL (0x8071) — tilemap COLUMN cell under the tracked object, derived from
 *  position counter 0x806b (>>3), written by resolveObjectTile/stepObjectAndResolveTile/locateObjectCellCheckGoal/locateActorCellCheckGoal and seeded 5; the low
 *  part of the 0x806e VRAM cell pointer (fair)
 */
export const PLAYER_TILE_COL = 0x8071;
/**
 *  PLAYER_TILE_ROW (0x8073) — tilemap ROW cell under the tracked object, derived from counter
 *  0x8068 (0x1f-((x+bias)>>3)), written by resolveObjectTile/stepObjectAndResolveTile/stepObjectRowUnflipped/stepObjectRowFlipped and seeded 0x19; the *0x20
 *  major part of the 0x806e VRAM cell pointer (fair)
 */
export const PLAYER_TILE_ROW = 0x8073;

// ── Probe-cell walk + sub-tile phase + mover dispatch state ──
/**
 *  PROBE_CELL_PTR (0x8089) — 16-bit VRAM/tilemap cell pointer (base 0x9000) written in
 *  stepEnemyMover/loc_3289 and dereferenced+stepped ±0x20/row by the tile-probe helpers
 *  tileInProbeRow/probeRowBackTilePair/nextTileInProbeRow/probeRowAheadTilePair; A, B and my derivation all agree, grounded across writer + four
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
 *  ENEMY_WORK_STATE (0x8090) — signed state byte of the enemy in the 0x8083 work slot: stepEnemyMover
 *  dispatches on its sign (neg->advanceDormantMover dormant tick, zero->arm 0x808b countdown,
 *  positive->player-box branch) and advanceDormantMover bumps it each call. Also the LASER-KILL death
 *  marker: a shot enemy is parked at 0xc0 and free-run to respawn (§2.3/§2.4, grounded). (fair)
 */
export const ENEMY_WORK_STATE = 0x8090;

// ── Reaction object (position paired with the player box) ──
/**
 *  REACTION_OBJ_X (0x8094) — PLAYER_Y-paired position coordinate of the REACTION_STATE (0x80a2)
 *  entity: written each frame by advancePlayerLaser from PLAYER_Y±8, player-box-tested in stepEnemyMover, placed
 *  by spawnDigEntity, written to sprite record byte 0, inited 0 by resetReactionState; both converge, well
 *  grounded. (fair)
 */
export const REACTION_OBJ_X = 0x8094;
/**
 *  REACTION_OBJ_Y (0x8097) — PLAYER_X-paired position coordinate of the REACTION_STATE (0x80a2)
 *  entity: written by advancePlayerLaser from PLAYER_X±8, player-box-tested in stepEnemyMover against the 0x8086
 *  axis, written to sprite record byte 3, inited 0 by resetReactionState; both converge, well grounded.
 *  (fair)
 */
export const REACTION_OBJ_Y = 0x8097;

// ── Falling-hazard / dig object record (type / timer / subtype / arm-state) ──
/**
 *  HAZARD_TYPE (0x80ab) — falling-hazard type = its glyph: **0x06 rock / 0x07 arrow** (§2.5, grounded).
 *  loc_2bd3 writes it straight into the hazard sprite record's TILE byte (0x822a), so the type IS the
 *  tile drawn — rock and arrow are the SAME object with a different glyph. The resting/seed value is 0x07
 *  (arrow), flipped to 0x06 (rock) when a dig disturbs the drop queue. (★ the earlier "byte2 color
 *  attribute" reading was wrong — 0x06/0x07 are type codes, not colours.) (fair) */
export const HAZARD_TYPE = 0x80ab;
/**
 *  DIG_OBJ_TIMER (0x80b1) — countdown/animation timer for the dig-carve object, armed to
 *  0x08/0x10/0x40 or reloaded from 0x80c2, decremented per frame and acted on at expiry across 7 routines
 *  (captureTargetOnOverlap/advanceDigCarveObject/triggerDigReaction/spawnPendingDigObject/spawnDigEntity/commitDigEntity/seedDigObjectBlock).
 *  ★ Shared: this same byte is the falling-hazard LIFETIME (§2.5). (fair) */
export const DIG_OBJ_TIMER = 0x80b1;
/**
 *  DIG_OBJ_SUBTYPE (0x80c0) — sub-type/variant selector of the committed dig entity, written
 *  by spawnDigEntity and dispatched by loc_298a and advanceDigCarveObject (0=plain/ret, 2=special: arm timer +
 *  patch neighbour tiles to 0xc1); grounded across 4 routines, A/B converged (fair)
 */
export const DIG_OBJ_SUBTYPE = 0x80c0;
/**
 *  DIG_COLLISION_STATE (0x80c1) — arm/capture state of the carve object
 *  (0=idle,1=armed/captured,2=latched): gates advanceTrackedObject dispatch, set by capture captureTargetOnOverlap and
 *  arm triggerDigReaction, cleared with the block by seedDigObjectBlock; grounded across 7 routines, role
 *  converged (name prefix normalised to the DIG_OBJ family) (fair)
 */
export const DIG_COLLISION_STATE = 0x80c1;

// ── The Zonker tank + its lobbed shell (background scenery animation, §2.6) ──
/**
 *  ZONKER_X (0x80db) — the Zonker TANK's X (byte0): a horizontal bounce oscillator in [0x19,0x38)
 *  (velocity 0x80df) init 0x28 by seedZonker, published as byte0 of the slot-3 record 0x822c;
 *  matches the ENEMY3_X byte convention. Grounded (§2.6). (fair) */
export const ZONKER_X = 0x80db;
/**
 *  ZONKER_FRAME (0x80dc) — tank sprite tile/frame code toggled 0x38<->0x39 every 8 frames
 *  (advanceZonker/advanceZonkerAnimation/setZonkerFrame), init 0x39, published as the code byte of the slot-3
 *  record. Grounded (§2.6). (fair) */
export const ZONKER_FRAME = 0x80dc;
/**
 *  ZONKER_ATTR (0x80dd) — byte2 attribute (color low bits + priority) of the tank sprite; bumped by
 *  advanceZonker with `and 0xf7` holding priority bit3 clear while cycling color, init 0xc0;
 *  role converged (normalised to ATTR per video.js decode) (fair) */
export const ZONKER_ATTR = 0x80dd;
/**
 *  ZONKER_SHELL_Y (0x80de) — Y (byte3) of the SHELL the tank lobs: accelerating vertical fall
 *  (step 0x80e0) clamped at 0x86 then RNG-reseeded by advanceZonker (the tank repeatedly
 *  lobbing a shell, §2.6), init 0x78, published as byte3 of the slot-3 record. Grounded (§2.6). (fair) */
export const ZONKER_SHELL_Y = 0x80de;

// ── Zonker oscillator phase + mountain scroll-reveal (period / gate / cursor), §2.6 ──
/**
 *  ZONKER_ANIM_PHASE (0x80e3) — Down-counter mod 8: decremented per frame, reloads 8 on wrap
 *  and toggles sprite frame 0x80dc, low bits gate the oscillator; read by advanceZonkerAnimation and
 *  advanceZonker, seeded 1 by seedZonker — A and B agree, derivation confirms. (fair)
 */
export const ZONKER_ANIM_PHASE = 0x80e3;
/**
 *  ZONKER_REVEAL_PERIOD (0x80e4) — Level-derived reload period (7..3 via A^=0x07 from 0x8028) for
 *  the reveal gate 0x80e5; written by seedZonker, consumed by revealTerrainColumn/advanceZonker on gate wrap —
 *  both namers converge, derivation confirms. (fair)
 */
export const ZONKER_REVEAL_PERIOD = 0x80e4;
/**
 *  ZONKER_REVEAL_GATE (0x80e5) — Per-column frame-gate down-counter: decremented each call, on wrap
 *  reloads from ZONKER_REVEAL_PERIOD 0x80e4 and reveals one terrain column; revealTerrainColumn/advanceZonker,
 *  seeded 1 by seedZonker — grounded and convergent. (fair)
 */
export const ZONKER_REVEAL_GATE = 0x80e5;
/**
 *  ZONKER_REVEAL_CURSOR (0x80e6) — Byte offset into tile-pattern table 0x3048, stepped back 6 per
 *  reveal (underflow ends reveal), seeded 0x96 by seedZonker; advanced by revealTerrainColumn/advanceZonker and
 *  independently tested ==0 by dispatcher advanceTrackedObject as the reveal-finished gate. (fair)
 */
export const ZONKER_REVEAL_CURSOR = 0x80e6;

// ── Object 1 record + Object 2 record ──
/**
 *  ENEMY1_X (0x80e8) — Base (offset 0) of the first object record: seeded/reset 0xec
 *  (seedEnemyRecords/stepEnemyMover), copied to sprite record 0x8230 byte 0 by updateEnemy1 — the SAME structural
 *  field as ENEMY2_X (0x80f9), so X by the house convention (offset 0 = X, ENEMY3_X/PLAYER_Y). Under
 *  ROT90 the sprite's hardware-Y byte is the on-screen horizontal, which the codebase calls X.
 *  (The record's Y is the offset-3 byte 0x80eb, still hex.) (fair)
 */
export const ENEMY1_X = 0x80e8;
/**
 *  ENEMY1_SPRITE (0x80e9) — Object-1 record byte1: seeded 0x09 by seedEnemyRecords, copied to
 *  sprite byte 0x8231 by updateEnemy1; video.js decodes it as code&0x3f + flipX(0x40) +
 *  flipY(0x80) — sprite code+orientation confirmed. (fair)
 */
export const ENEMY1_SPRITE = 0x80e9;
/**
 *  ENEMY1_ATTR (0x80ea) — Object-1 record offset 2: seeded 0x04 (seedEnemyRecords), copied verbatim to
 *  sprite-record byte 2 (updateEnemy1), color-cycled with priority bit 3 held clear (advanceDormantMover) --
 *  A/B and my derivation all agree. (fair)
 */
export const ENEMY1_ATTR = 0x80ea;
/**
 *  ENEMY1_MOVE_PERIOD (0x80f6) — Object-1 record offset 14: seedEnemyRecords derives 7-(LEVEL&6)
 *  (faster as level climbs) and loc_3490 reloads the offset-8 cadence timer from it -- A/B
 *  converge (reload/period) and my derivation agrees, grounded across two routines. (fair)
 */
export const ENEMY1_MOVE_PERIOD = 0x80f6;
/**
 *  ENEMY1_TARGET_COL (0x80f8) — Object-1 record offset 16 target column: seeded 0x04
 *  (seedEnemyRecords); stepEnemyMover fast-exits when 0x807a equals it and keys the tile-probe/direction
 *  dispatch on it -- A/B and my derivation agree. (fair)
 */
export const ENEMY1_TARGET_COL = 0x80f8;
/**
 *  ENEMY2_X (0x80f9) — Base (offset 0) of the second 17-byte object record: staged/emitted as
 *  sprite byte 0 by updateEnemy2, position-tested in stepEnemyMover, seeded 0x00; matches house
 *  convention ENEMY3_X=offset 0 -- A/B agree. (fair)
 */
export const ENEMY2_X = 0x80f9;
/**
 *  ENEMY2_SPRITE (0x80fa) — Object-2 record offset 1 sprite tile/code byte: seeded 0x09, emitted
 *  verbatim to sprite byte 1 (updateEnemy2), rewritten with the direction/orientation code
 *  (stepEnemyMover/stepMoverUp); matches house convention ENEMY3_TILE=offset 1 -- A/B agree. (fair)
 */
export const ENEMY2_SPRITE = 0x80fa;
/**
 *  ENEMY2_ATTR (0x80fb) — Object-2 record offset 2 attr/color byte: seeded 0x04, emitted to
 *  sprite byte 2, color-cycled with priority bit 3 held clear by advanceDormantMover -- same field as
 *  ENEMY1_ATTR; A/B and my derivation agree. (fair)
 */
export const ENEMY2_ATTR = 0x80fb;

// ── Actor per-frame step + twin timer + saved cell pointer ──
/**
 *  ENEMY3_STEP_X (0x810e) — Low byte of the actor 16-bit step vector: advanceTwoSpriteActor loads it into L
 *  and adds it to ENEMY3_X (0x810a) each cadence tick; seeded 0xff(-1)/0 by
 *  seedActorSpawnState/3767/advanceOrRebuildTwinActor. Real reader, A and B agree, my derivation confirms. (fair)
 */
export const ENEMY3_STEP_X = 0x810e;
/**
 *  ENEMY3_STEP_Y (0x810f) — High byte of the actor step vector: advanceTwoSpriteActor loads it into H and
 *  adds it to ENEMY3_Y (0x810d) each cadence tick; seeded alongside 0x810e. Real reader, A and
 *  B agree, my derivation confirms. (fair)
 */
export const ENEMY3_STEP_Y = 0x810f;
/**
 *  ENEMY3_TWIN_TIMER (0x8123) — Both namers converged and my derivation agrees: twin of
 *  ENEMY3_TIMER(0x8112); record+8 -> scratch 0x808b, decremented/reloaded as the cadence
 *  countdown by stepEnemyMover (0x31b1) and armed (0xb4/0x01) by the spawn seeders. Grounded across
 *  seeders + stepEnemyMover; primary ENEMY3_TIMER already named, so pairing is consistent. (fair)
 */
export const ENEMY3_TWIN_TIMER = 0x8123;
/**
 *  SAVED_CELL_PTR (0x8134) — Both namers converged and my derivation agrees: a 16-bit scratch
 *  slot holding a tilemap cell pointer. probeRowBackTilePair and probeRowAheadTilePair each do 'ld (0x8134),hl' (save
 *  advanced/one-row-back cursor) then 'ld ix,(0x8134)' a few instructions later. Grounded
 *  across two neighbour-search routines as a within-search save/restore. (fair)
 */
export const SAVED_CELL_PTR = 0x8134;

// ── Clarify pass 2026-07-27 (proposer≠confirmer + judge; the loot/dig/sprite subsystems
//    that the batch-3/4/5 decompiles made legible). (fair) unless noted. ──────────────

// ── Loot pickup counters + high-score table ──
/**
 *  CRYSTAL_COUNT (0x8081) — count of crystals collected (tile 0x3a): the collect path awards
 *  bc=0x0010 BCD (**displayed +1000** — all score is shown ×100, §2.8) then increments it; seeded 0,
 *  read by the board-complete bonus as a threshold (==4). Grounded (§2.8, grounding-2 Z-3). (fair) */
export const CRYSTAL_COUNT = 0x8081;
/**
 *  DIAMOND_COUNT (0x8082) — count of diamonds collected (tiles 0x3b/0x3c/0x3d): the collect path
 *  awards bc=0x0020 BCD (**displayed +2000**, gated by PRIZE_GATE + the TREASURE_COLLECTED one-shot)
 *  then increments it; seeded 0, read by the board-complete bonus as a threshold (==3). Grounded
 *  (§2.8). (fair) */
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
 *  is UNPROVEN — do not assert a coupling. (fair)
 */
export const TREASURE_COLLECTED = 0x8078;
/**
 *  HIGH_SCORE_TABLE (0x8039) — Base/top rank of the descending three-entry high-score table
 *  (5-byte records: 3 initials + 16-bit score at 0x8039/0x803e/0x8043); seeded by initScoreDisplay,
 *  rendered by renderScoreReadouts, ranked-inserted with 0xFF initials placeholders by insertHighScore, blitted
 *  by runHighScoreInitialsEntry. (fair)
 */
export const HIGH_SCORE_TABLE = 0x8039;

// ── Object phase/step + mover direction ──
/**
 *  PLAYER_ANIM_PHASE (0x801a) — Tracked object's packed animation/command phase byte (high bits
 *  wind-up countdown stepped -0x20, low bits &0x0c = move command vs L); seeded 0 by
 *  seedObjectStartState, reconciled each frame by windUpObjectMove, zeroed on the idle path by routeIdleObjectByMoveCommand. (fair)
 */
export const PLAYER_ANIM_PHASE = 0x801a;
/**
 *  PLAYER_STEP_Y (0x806c) — the player's per-frame Y step: added to the committed PLAYER_Y (0x8068)
 *  by walkActor, subtracted from it by advanceObjectWalkFrame, low byte of the DE step-vector in
 *  advanceTrackedObject, seeded 1 by seedObjectStartState. (fair)
 */
export const PLAYER_STEP_Y = 0x806c;
/**
 *  PLAYER_STEP_X (0x806d) — the player's per-frame X step: added to the committed PLAYER_X (0x806b)
 *  by advanceActorWalk, subtracted by stepObjectAndResolveTile, high byte of the DE step-vector in
 *  advanceTrackedObject, seeded 1 by seedObjectStartState. (fair)
 */
export const PLAYER_STEP_X = 0x806d;
/**
 *  ENEMY_WORK_DIR (0x8092) — Published travel-direction index: stamped 0/1/2/3 by the four
 *  direction presets (stepMoverUp/stepMoverMirrored/stepMoverDown/stepMoverUnmirrored) at 0x34a0, consumed by stepEnemyMover's dec-a/jp-z
 *  direction fan-out at 0x32ce and 0x3345; A and B and my derivation all converge. (fair)
 */
export const ENEMY_WORK_DIR = 0x8092;

// ── Dig-entity staging (spawnDigEntity -> commitDigEntity hand-off) + expected tile ──
/**
 *  EXPECTED_TILE (0x80a7) — The object cell's table-resolved expected tile: seeded from the
 *  raw under-tile then overwritten with the ROM lookup, cross-checked vs CUR_TILE 0x80a5 in
 *  loc_164f to detect a change, and stamped into (ix+0) by advancePlayerLaser; both namers converged
 *  high-confidence, real readers + writers. (fair)
 */
export const EXPECTED_TILE = 0x80a7;
/**
 *  STAGED_TARGET_X (0x80b6) — Staged X coord = REACTION_OBJ_X-4 written by spawnDigEntity, promoted
 *  into HAZARD_X 0x80a9 by commitDigEntity and X-axis bbox-tested vs PLAYER_Y 0x8068 by advanceDigCarveObject; both
 *  namers converged, grounded across all three. (fair)
 */
export const STAGED_TARGET_X = 0x80b6;
/**
 *  STAGED_TARGET_Y (0x80b9) — Staged Y coord (PLAYER_X grid-snapped and lifted) written by
 *  spawnDigEntity, promoted into HAZARD_Y 0x80ac by commitDigEntity and Y-axis bbox-tested vs PLAYER_X 0x806b
 *  by advanceDigCarveObject; both namers converged, grounded across all three. (fair)
 */
export const STAGED_TARGET_Y = 0x80b9;
/**
 *  STAGED_CELL_PTR (0x80ba) — 16-bit copy of PLAYER_CELL_PTR 0x806e saved by spawnDigEntity and
 *  reloaded into the live carve cursor 0x80af by commitDigEntity; both namers converged and
 *  SAVED_CELL_PTR is already taken by 0x8134 in ram.js, so STAGED_CELL_PTR is the correct
 *  distinct name. (fair)
 */
export const STAGED_CELL_PTR = 0x80ba;
/**
 *  STAGED_DIG_TIMER (0x80bc) — spawnDigEntity writes REACTION_PERIOD<<1 here; commitDigEntity promotes it
 *  verbatim into the named DIG_OBJ_TIMER (0x80b1) -- a clean single writer/reader staging
 *  cell for the dig timer, A+B converged. (fair)
 */
export const STAGED_DIG_TIMER = 0x80bc;
/**
 *  STAGED_DIG_SPRITE_ID (0x80bf) — spawnDigEntity stages the classified dig-entity id here;
 *  commitDigEntity stamps it into the tilemap cell before the carve cursor (mem[cellPtr-1]) -- clean
 *  writer/reader pair, A+B converged. (fair)
 */
export const STAGED_DIG_SPRITE_ID = 0x80bf;

// ── Sprite record attributes + staging buffer base + loop counter ──
/**
 *  ENEMY3_ATTR (0x810c) — Byte+2 of the primary sprite record 0x810a: stageActorSpriteRecords copies it to
 *  sprite-RAM byte2 (0x823a), which video.js decodes as color(bits0-2)+priority(bit3); seeded
 *  by all four spawners. Grounded, A+B converged. (fair)
 */
export const ENEMY3_ATTR = 0x810c;
/**
 *  ENEMY3_TWIN_ATTR (0x811d) — Byte+2 of the twin record 0x811b; stageActorSpriteRecords copies it to sprite-RAM
 *  byte2 (0x823e), decoded as color+priority by video.js -- mirror of ENEMY3_ATTR, same
 *  seeders. Grounded, A+B converged. (fair)
 */
export const ENEMY3_TWIN_ATTR = 0x811d;
/**
 *  SPRITE_STAGING_BASE (0x8220) — Base of the 32-byte (8x4) sprite-record staging buffer the
 *  NMI serviceVblankNmi LDIRs to hardware sprite RAM 0x9840 each frame; filled by
 *  stageObjectSpriteRecord/stageActorSpriteRecords, wiped by clearSpriteStagingBuffer.
 *  Grounded, A+B converged. (fair)
 */
export const SPRITE_STAGING_BASE = 0x8220;
/**
 *  LOOP_COUNTER (0x800a) — Memory-resident down-counter seeded to an iteration count then
 *  decremented to 0 to repeat a loop body; grounded identically across setup-repeat
 *  setUpRoundAndHoldIntro/holdRoundIntroLoop, screen-hold showSetupScreen, and animation-tier showBonusScreen. (fair)
 */
export const LOOP_COUNTER = 0x800a;

// ═══ NAMING PASS 2026-07-27 (full-decompile: credit/coin/mode + object/mover records) ═══════
// proposer≠confirmer over the whole 169-routine layer; write-only/dead/mixed-role cells left hex
// (0x801d/0x812d/0x8050/0x8052 mode+flip shadows are write-only; player-record backups stay hex).

/** CREDIT_COUNT (0x8000) — the credit counter: banked from the coin lines (clamp 9), spent on start;
 *  the corruption-watchdog anchor (serviceVblankNmi cold-boots if the mirrors disagree); rearmMachineAndBranchOnCredits
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
/** FRAME_COUNTER_PRESCALER (0x8007) — /60 down-divider; on rollover reloads 60 and ticks PLAY_PHASE_COUNTER. (strong) */
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
/** ENEMY2_MOVE_PERIOD (0x8107) — OBJ2 mover cadence reload period; structural mirror of ENEMY1_MOVE_PERIOD. (strong) */
export const ENEMY2_MOVE_PERIOD = 0x8107;
/** ENEMY2_TARGET_COL (0x8109) — OBJ2 mover target column (seed 5 → stepEnemyMover steer path); mirror of ENEMY1_TARGET_COL. (strong) */
export const ENEMY2_TARGET_COL = 0x8109;
/** ENEMY1_TIMER (0x80f0) — OBJ1 mover cadence/dwell countdown (record offset 8). (fair) */
export const ENEMY1_TIMER = 0x80f0;
/** ENEMY1_STATE (0x80f5) — OBJ1 mover signed state byte stepEnemyMover sign-dispatches on (record offset 13). (fair) */
export const ENEMY1_STATE = 0x80f5;
/** ENEMY2_TIMER (0x8101) — OBJ2 mover cadence/dwell countdown (mirror of ENEMY1_TIMER). (fair) */
export const ENEMY2_TIMER = 0x8101;
/** ENEMY2_STATE (0x8106) — OBJ2 mover signed state byte (mirror of ENEMY1_STATE). (fair) */
export const ENEMY2_STATE = 0x8106;
/** ENEMY_WORK_MOVE_PERIOD (0x8091) — working-block mover cadence reload period (parallels ENEMY1_MOVE_PERIOD). (fair) */
export const ENEMY_WORK_MOVE_PERIOD = 0x8091;
/** ENEMY_WORK_TARGET_COL (0x8093) — working-block mover target column stepEnemyMover steers toward. (fair) */
export const ENEMY_WORK_TARGET_COL = 0x8093;
/** CARVE_SEAM_LEFT (0x807e) — flag advanceDigCarveObject sets when a dug channel abuts the object's tile column on
 *  one side; stepObjectRowFlipped reads it to defer that step. Axis confirmed screen-HORIZONTAL; the specific
 *  left-vs-right assignment is rotation-ambiguous (which arm is "left" is not pinned). (fair) */
export const CARVE_SEAM_LEFT = 0x807e;
/** CARVE_SEAM_RIGHT (0x807f) — mirror seam flag for the opposite move arm (stepObjectRowUnflipped reads it). (fair) */
export const CARVE_SEAM_RIGHT = 0x807f;
/** LASER_SCAN_PTR (0x809a, 16-bit) — tilemap cell the horizontal terrain-scroll walker samples. (fair) */
export const LASER_SCAN_PTR = 0x809a;
/** SCROLL_SUBPHASE (0x809e) — sub-tile column phase selecting the ROM stop-tile slice for the scroll. (fair) */
export const SCROLL_SUBPHASE = 0x809e;
/** DROP_QUEUE (0x80c3) — base of the 24-slot pending-spawn column queue (12 left paired to 12 right). (fair) */
export const DROP_QUEUE = 0x80c3;
/** SCORE_READOUT_STRIP (0x8280) — base of a 32-cell work-RAM display strip staging the rightmost
 *  on-screen score-readout column. (fair) */
export const SCORE_READOUT_STRIP = 0x8280;
/** ENEMY3_SPRITE_SLOT (0x8238) — sprite-staging slot 6 (SPRITE_STAGING_BASE+24), the actor body's record. (fair) */
export const ENEMY3_SPRITE_SLOT = 0x8238;
/** ENEMY3_TWIN_SPRITE_SLOT (0x823c) — sprite-staging slot 7 (SPRITE_STAGING_BASE+28), the twin's record. (fair) */
export const ENEMY3_TWIN_SPRITE_SLOT = 0x823c;
