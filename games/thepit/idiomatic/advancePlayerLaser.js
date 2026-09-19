// SPDX-License-Identifier: GPL-3.0-only
/**
 * advancePlayerLaser — per-frame driver of the player's horizontal laser AND the dig/push carve
 * reaction, which time-multiplex one sprite slot; also tail-chains the whole actor pipeline each
 * frame (dig-carve/hazards → chamber creature → enemies → enemy-3).
 * It reads fire (input bit 4) and, with a horizontal facing, launches/flies a laser bolt; otherwise
 * it runs the reaction object — the short animation the player plays as it digs or pushes into
 * terrain — dispatching per frame to a goal/dig owner, an in-progress scroll, an edge-collision arm,
 * or the active reaction phase (one of four, one per 8-pixel direction). A phase that expires writes
 * the resolved tiles into the actor's map cell, publishes a facing, and (three of the four) spawns
 * the dug entity; the timer passing 24 on the way down cues the reaction sound.
 * Every path finishes by building the object's 4-byte sprite record and handing the frame to the
 * dig-object driver, whose own return unwinds to this routine's caller.
 */

import { u8 } from "../../../core/int.js";
import { BOARD_END_PHASE, DIG_COLLISION_STATE, EXPECTED_TILE, GOAL_TILE_LATCH, HAZARD_ACTIVE_COUNT, IN0_DEBOUNCED, LASER_SCAN_PTR, LASER_STATE, NEXT_TILE, PIT_CROSS_ACTIVE, PLAYER_ACTIVE, PLAYER_CELL_PTR, PLAYER_FACING, PLAYER_X, PLAYER_Y, REACTION_OBJ_ATTR, REACTION_OBJ_CODE, REACTION_OBJ_X, REACTION_OBJ_Y, REACTION_STATE, REACTION_TIMER, SCROLL_SUBPHASE, SPRITE_COORD_BIAS, SPRITE_STAGING_BASE, STOP_TILE_TABLE, VIDEO_RAM_BASE } from "./names.js";
import { spawnDigEntity } from "./spawnDigEntity.js";
import { requestSound9 } from "./requestSound9.js";
import { requestSound12 } from "./requestSound12.js";
import { advanceDigCarveObject } from "./advanceDigCarveObject.js";

// The horizontal-scroll state (a persistent 3-byte block driving the terrain walk).
const SCROLL_STEP = LASER_STATE; // signed per-frame X step; bit 3 set marks a scroll in progress,
//                             bit 7 its direction (set -> window +32/row, clear -> -32/row)

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
 * The four reaction phases (REACTION_STATE 1..4): each offsets the reaction object a fixed 8 pixels
 * from the tracked object along one axis, shows its own animating sprite, and on the timer expiring
 * settles to a rest facing and resolves the dug tiles. `secondCell` places the second resolved tile
 * relative to the actor's cell (phase 4 before it, the rest after); phase 3 does NOT spawn the dug
 * entity; `clearStateFirst` ends the reaction before the resolve work (phases 2, 3) rather than
 * after the spawn (phases 1, 4).
 */
const PHASES = {
  1: { animSprite: 168, restFacing: 178, offX: -8, offY: 0, spawnEntity: true, secondCell: 1, clearStateFirst: false },
  2: { animSprite: 40, restFacing: 50, offX: 8, offY: 0, spawnEntity: true, secondCell: 1, clearStateFirst: true },
  3: { animSprite: 41, restFacing: 52, offX: 0, offY: 8, spawnEntity: false, secondCell: 1, clearStateFirst: true },
  4: { animSprite: 105, restFacing: 180, offX: 0, offY: -8, spawnEntity: true, secondCell: -1, clearStateFirst: false },
};

export function advancePlayerLaser(m) {
  const { mem8 } = m;

  // A goal crossing or an armed dig object owns the frame: rest sprite, then publish the record.
  if (mem8[PIT_CROSS_ACTIVE] !== 0 || mem8[DIG_COLLISION_STATE] !== 0) {
    mem8[REACTION_OBJ_CODE] = REST_SPRITE;
    return buildReactionRecord(m);
  }

  if ((mem8[SCROLL_STEP] & 0x08) !== 0) return advanceScroll(m);

  if (mem8[HAZARD_ACTIVE_COUNT] === 2) return handleEdgeCollision(m);

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
    // Still animating: slide the object to its fixed offset and cycle the 3-bit animation counter.
    mem8[REACTION_OBJ_X] = mem8[PLAYER_Y] + phase.offX;
    mem8[REACTION_OBJ_Y] = mem8[PLAYER_X] + phase.offY;
    mem8[REACTION_OBJ_ATTR] = (mem8[REACTION_OBJ_ATTR] - 1) & 7;
    return buildReactionRecord(m);
  }

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
 * another sub-system, hand the frame straight to the dig-object driver; otherwise start a scroll
 * from the facing when none is set, or clear one that is set unless the dig button is still held.
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
 * direction: two facing codes seed a leftward step, two a rightward one; any other just hands off.
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
 * tracked object's position, and compute the tilemap window it will walk. The window cell is the
 * tilemap base + row*32 + column, the row inverted from the object's X and the column from its Y
 * (the playfield is rotated a quarter turn, so X drives the row). The sub-tile column phase selects
 * which stop-tile list the walk checks against.
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
  mem16[LASER_SCAN_PTR] = VIDEO_RAM_BASE + windowRow * 32 + windowCol;

  return advanceScroll(m);
}

/**
 * Advance an in-progress scroll one step: slide the object by the latched step, move the window one
 * row in the step's direction, sample the tile at the window cell (or its neighbour past the
 * mid-column seam), and if it is in this sub-column's stop-list reset the object and end the scroll.
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
 * Build the reaction object's 4-byte sprite record (position biased by the sprite offset, plus its
 * sprite + animation bytes), then hand the frame to the dig-object driver — its return goes to our caller.
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
