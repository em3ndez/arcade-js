// SPDX-License-Identifier: GPL-3.0-only
/**
 * advancePlayerLaser — per-frame driver of the player's horizontal laser AND the dig/push carve
 * reaction, which time-multiplex ONE sprite slot (0x8094-0x80a4); also tail-chains the whole actor
 * pipeline each frame (dig-carve/hazards → chamber creature → enemies → enemy-3).  ROM 0x24f3. (§2.3)
 *
 * At loc_26be it reads fire (input bit 4) and, with a horizontal facing, launches/flies a laser bolt
 * (see LASER_STATE 0x80a1). Otherwise it runs the reaction object — the short animation the player
 * plays as it digs or pushes into terrain. Each frame it decides what that shared object does:
 *
 *   - If a goal crossing or an armed dig object already owns the frame, it just shows the
 *     rest sprite and publishes the object's sprite record.
 *   - If a horizontal scroll is already in progress, it advances the object across the
 *     terrain a step at a time, stopping (and resetting the object) when the cell ahead is
 *     one of that sub-column's stop tiles.
 *   - If an edge collision was just flagged, it may start such a scroll — reading the input
 *     and the object's facing to seed the scroll window from the object's tilemap cell — or,
 *     failing the gates, clear the scroll mode.
 *   - Otherwise it runs the active reaction phase (one of four, one per 8-pixel direction):
 *     while the phase timer ticks it slides the object to a fixed 8-pixel offset from the
 *     tracked object and cycles its animation; when the timer expires it settles the object
 *     to the rest sprite, writes the resolved tiles into the actor's map cell, publishes a
 *     facing code, and — for three of the four phases — spawns the dug entity, ending the
 *     reaction. The timer passing 24 on the way down cues the reaction sound.
 *
 * Every path finishes by building the object's 4-byte sprite record and handing the frame
 * to the dig-object driver, whose own return unwinds to this routine's caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-24f3.test.js.
 * GATE:     crafted-entry — dispatched every frame from the main loop (its natural inputs
 *           sit on the idle arm), captured live; the four reaction phases, the scroll walk
 *           and the edge-collision arm are driven by poking the decision bytes identically
 *           on both sides. RAM-only diff minus the dead stack scratch at the top of work
 *           RAM; pc/SP/value-registers are the dead Z80 trace (every hand-off is an
 *           idiomatic call that returns via plain JS, so a pc/SP contract would false-fail).
 * LIVE-OUT: memory-only — the reaction object's position + sprite record, the resolved map
 *           cell + spawned dig entity, the scroll window/step/sub-phase, plus whatever the
 *           delegated dig-object driver leaves. Reads every input from RAM; returns nothing
 *           a caller consumes.
 * NAMES:    PIT_CROSS_ACTIVE, DIG_COLLISION_STATE, HAZARD_ACTIVE_COUNT, REACTION_STATE,
 *           REACTION_TIMER, REACTION_OBJ_X, REACTION_OBJ_Y, PLAYER_Y, PLAYER_X, PLAYER_CELL_PTR,
 *           EXPECTED_TILE, NEXT_TILE, PLAYER_FACING, SPRITE_COORD_BIAS, PLAYER_ACTIVE,
 *           BOARD_END_PHASE, GOAL_TILE_LATCH, IN0_DEBOUNCED, SPRITE_STAGING_BASE,
 *           REACTION_OBJ_CODE (0x8095), REACTION_OBJ_ATTR (0x8096), LASER_SCAN_PTR (0x809a)
 *           and SCROLL_SUBPHASE (0x809e) from ram.js. The scroll step (0x80a1) and the ROM
 *           stop-tile table (0x277a) have no confirmed name yet and stay hex.
 */

import { u8 } from "../../../core/int.js";
import {
  PIT_CROSS_ACTIVE,
  DIG_COLLISION_STATE,
  HAZARD_ACTIVE_COUNT,
  REACTION_STATE,
  REACTION_TIMER,
  REACTION_OBJ_X,
  REACTION_OBJ_Y,
  PLAYER_Y,
  PLAYER_X,
  PLAYER_CELL_PTR,
  EXPECTED_TILE,
  NEXT_TILE,
  PLAYER_FACING,
  SPRITE_COORD_BIAS,
  PLAYER_ACTIVE,
  BOARD_END_PHASE,
  GOAL_TILE_LATCH,
  IN0_DEBOUNCED,
  SPRITE_STAGING_BASE,
  REACTION_OBJ_CODE,
  REACTION_OBJ_ATTR,
  LASER_SCAN_PTR,
  SCROLL_SUBPHASE,
} from "./ram.js";
import { spawnDigEntity } from "./spawnDigEntity.js";
import { requestSound9 } from "./requestSound9.js";
import { requestSound12 } from "./requestSound12.js";
import { advanceDigCarveObject } from "./advanceDigCarveObject.js";

// The horizontal-scroll state (a persistent 3-byte block driving the terrain walk).
const SCROLL_STEP = 0x80a1; // signed per-frame X step; bit 3 set marks a scroll in progress,
//                             bit 7 its direction (set -> window +32/row, clear -> -32/row)
const STOP_TILE_TABLE = 0x277a; // ROM: eight 32-byte per-sub-column lists of stop tiles

// The reaction object owns sprite slot 1 (four bytes per slot) of the staging buffer.
const REACTION_SPRITE_SLOT = SPRITE_STAGING_BASE + 4;

const REST_SPRITE = 9; // the neutral "at rest" sprite code (shown whenever no phase animates)
const SCROLL_SPRITE = 58; // sprite code while a scroll is being seeded
const SEAM_SUBPHASE = 160; // sub-phase at/above which the scroll samples the neighbouring cell

// The two horizontal scroll steps stored in SCROLL_STEP; bit 7 is later read back as the
// scroll direction, so their exact bit pattern is load-bearing.
const SCROLL_STEP_NEG = 0xf8; // -8 per frame
const SCROLL_STEP_POS = 0x08; // +8 per frame

/**
 * The four reaction phases (REACTION_STATE 1..4): each offsets the reaction object a fixed
 * 8 pixels from the tracked object along one axis, shows its own animating sprite, and on
 * the timer expiring settles to a rest facing and resolves the dug tiles.
 *   - `secondCell` is where the second resolved tile lands relative to the actor's map cell
 *     (phase 4 writes the cell BEFORE it; the rest, the cell after).
 *   - phase 3 does NOT spawn the dug entity.
 *   - `clearStateFirst` ends the reaction before the resolve work (phases 2, 3) rather than
 *     after the spawn (phases 1, 4); phase 4 deliberately keeps the state at 4 across the
 *     spawn so the spawn applies its one-pixel row bias.
 */
const PHASES = {
  1: { animSprite: 168, restFacing: 178, offX: -8, offY: 0, spawnEntity: true, secondCell: 1, clearStateFirst: false },
  2: { animSprite: 40, restFacing: 50, offX: 8, offY: 0, spawnEntity: true, secondCell: 1, clearStateFirst: true },
  3: { animSprite: 41, restFacing: 52, offX: 0, offY: 8, spawnEntity: false, secondCell: 1, clearStateFirst: true },
  4: { animSprite: 105, restFacing: 180, offX: 0, offY: -8, spawnEntity: true, secondCell: -1, clearStateFirst: false },
};

export function advancePlayerLaser(m) {
  const { mem8 } = m;

  // A goal crossing or an armed dig object owns the frame: force the rest sprite and just
  // publish the record.
  if (mem8[PIT_CROSS_ACTIVE] !== 0 || mem8[DIG_COLLISION_STATE] !== 0) {
    mem8[REACTION_OBJ_CODE] = REST_SPRITE;
    return buildReactionRecord(m);
  }

  // A horizontal scroll already in progress: advance it.
  if ((mem8[SCROLL_STEP] & 0x08) !== 0) return advanceScroll(m);

  // An edge collision was just flagged: maybe start a scroll.
  if (mem8[HAZARD_ACTIVE_COUNT] === 2) return handleEdgeCollision(m);

  // The reaction timer reaching 24 on its way down cues the reaction sound.
  if (mem8[REACTION_TIMER] === 24) requestSound9(m);

  // Run the active reaction phase; anything else is idle -> the edge-collision arm.
  const phase = PHASES[mem8[REACTION_STATE]];
  if (phase === undefined) return handleEdgeCollision(m);
  return runReactionPhase(m, phase);
}

/** Animate one reaction phase this frame, resolving the dug tiles when its timer expires. */
function runReactionPhase(m, phase) {
  const { mem8, mem16 } = m;
  mem8[REACTION_OBJ_CODE] = phase.animSprite;

  const ticked = u8(mem8[REACTION_TIMER] - 1);
  mem8[REACTION_TIMER] = ticked;
  if (ticked !== 0) {
    // Still animating: slide the object to its fixed offset from the tracked object and
    // cycle the 3-bit animation counter.
    mem8[REACTION_OBJ_X] = mem8[PLAYER_Y] + phase.offX;
    mem8[REACTION_OBJ_Y] = mem8[PLAYER_X] + phase.offY;
    mem8[REACTION_OBJ_ATTR] = (mem8[REACTION_OBJ_ATTR] - 1) & 7;
    return buildReactionRecord(m);
  }

  // The reaction finished. Settle to the rest sprite, write the resolved tiles into the
  // actor's map cell, publish the facing code, and (except phase 3) spawn the dug entity.
  if (phase.clearStateFirst) mem8[REACTION_STATE] = 0;
  mem8[REACTION_OBJ_CODE] = REST_SPRITE;
  const cell = mem16[PLAYER_CELL_PTR];
  if (mem8[EXPECTED_TILE] !== 0) mem8[cell] = mem8[EXPECTED_TILE];
  if (mem8[NEXT_TILE] !== 0) mem8[cell + phase.secondCell] = mem8[NEXT_TILE];
  mem8[PLAYER_FACING] = phase.restFacing;
  if (phase.spawnEntity) spawnDigEntity(m);
  if (!phase.clearStateFirst) mem8[REACTION_STATE] = 0;
  return buildReactionRecord(m);
}

/**
 * The edge-collision arm (HAZARD_ACTIVE_COUNT == 2, and the idle default). If the object is busy in
 * another sub-system just hand the frame straight to the dig-object driver; otherwise, when
 * no scroll mode is set start one from the facing, and when one is set clear it unless the
 * dig button is still held.
 */
function handleEdgeCollision(m) {
  const { mem8 } = m;
  if (mem8[PLAYER_ACTIVE] === 0) return advanceDigCarveObject(m);
  if (mem8[BOARD_END_PHASE] !== 0) return advanceDigCarveObject(m);
  if (mem8[GOAL_TILE_LATCH] !== 0) return advanceDigCarveObject(m);

  const in0 = mem8[IN0_DEBOUNCED];
  if (mem8[SCROLL_STEP] === 0) return maybeStartScroll(m, in0);
  if ((in0 & 0x10) !== 0) return advanceDigCarveObject(m); // dig still held -> leave the scroll mode as is
  mem8[SCROLL_STEP] = 0;
  return advanceDigCarveObject(m);
}

/**
 * With the dig button held, start a horizontal scroll if the object faces a scroll-capable
 * direction: two facing codes seed a leftward step, two a rightward one; any other facing
 * just hands off to the dig-object driver.
 */
function maybeStartScroll(m, in0) {
  const { mem8 } = m;
  if ((in0 & 0x10) === 0) return advanceDigCarveObject(m); // dig not held -> nothing to start
  const facing = mem8[PLAYER_FACING];
  if (facing === 178 || facing === 179) return seedScroll(m, SCROLL_STEP_NEG);
  if (facing === 50 || facing === 51) return seedScroll(m, SCROLL_STEP_POS);
  return advanceDigCarveObject(m); // facing is none of the four scroll-capable codes
}

/**
 * Seed a fresh horizontal scroll: latch the step, cue its sound, place the object at the
 * tracked object's position, and compute the tilemap window it will walk. The window cell is
 * base 0x9000 + row*32 + column, where the row is inverted from the object's X and the
 * column comes from its Y (the playfield is rotated a quarter turn, so X drives the row). The
 * sub-tile column phase selects which ROM stop-tile list the walk checks against.
 */
function seedScroll(m, scrollStep) {
  const { mem8, mem16 } = m;
  mem8[SCROLL_STEP] = scrollStep;
  requestSound12(m);
  mem8[REACTION_OBJ_ATTR] = 3;
  mem8[REACTION_OBJ_CODE] = SCROLL_SPRITE;

  const objX = mem8[PLAYER_Y];
  mem8[REACTION_OBJ_X] = objX;
  const objY = mem8[PLAYER_X];
  mem8[REACTION_OBJ_Y] = objY;

  const windowRow = 31 - (u8(objX + 3) >> 3);
  const stepY = u8(objY + 5);
  const windowCol = stepY >> 3;
  mem8[SCROLL_SUBPHASE] = (stepY & 7) << 5;
  mem16[LASER_SCAN_PTR] = 0x9000 + windowRow * 32 + windowCol;

  return advanceScroll(m);
}

/**
 * Advance an in-progress scroll one step: slide the object by the latched step, move the
 * window one row in the step's direction, then sample the tile at the window cell (or its
 * neighbour past the mid-column seam). If that tile is in this sub-column's ROM stop-list the
 * object has reached a wall — reset it and end the scroll; otherwise just publish the record.
 */
function advanceScroll(m) {
  const { mem8, mem16 } = m;
  const step = mem8[SCROLL_STEP];
  const rowDelta = (step & 0x80) !== 0 ? 32 : -32;

  mem8[REACTION_OBJ_X] = mem8[REACTION_OBJ_X] + step;
  mem16[LASER_SCAN_PTR] = mem16[LASER_SCAN_PTR] + rowDelta;
  const windowPtr = mem16[LASER_SCAN_PTR]; // read back the wrapped 16-bit value

  const subPhase = mem8[SCROLL_SUBPHASE];
  const tile = subPhase < SEAM_SUBPHASE ? mem8[windowPtr] : mem8[windowPtr + 1];

  const listStart = STOP_TILE_TABLE + subPhase;
  let hitWall = false;
  for (let i = 0; i < 32; i++) {
    if (mem8[listStart + i] === tile) { hitWall = true; break; }
  }
  if (!hitWall) return buildReactionRecord(m);

  // Reached a stop tile: park the object and end the scroll.
  mem8[REACTION_OBJ_X] = 0;
  mem8[SCROLL_STEP] = 1;
  mem8[REACTION_OBJ_CODE] = REST_SPRITE;
  return buildReactionRecord(m);
}

/**
 * Build the reaction object's 4-byte sprite record (position biased by the DSW sprite offset,
 * plus its sprite + animation bytes), then hand the frame to the dig-object driver — whose
 * return unwinds to this routine's own caller.
 */
function buildReactionRecord(m) {
  const { mem8 } = m;
  const bias = mem8[SPRITE_COORD_BIAS];
  mem8[REACTION_SPRITE_SLOT] = mem8[REACTION_OBJ_X] - bias;
  mem8[REACTION_SPRITE_SLOT + 1] = mem8[REACTION_OBJ_CODE];
  mem8[REACTION_SPRITE_SLOT + 2] = mem8[REACTION_OBJ_ATTR];
  mem8[REACTION_SPRITE_SLOT + 3] = mem8[REACTION_OBJ_Y] + bias;
  return advanceDigCarveObject(m);
}
