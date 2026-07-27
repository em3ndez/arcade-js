// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1493 — step the tracked object the opposite way along its move axis: derive its tile
 * row and route on it, firing the dig one-shot at the boundary row.  ROM 0x1493.
 *
 * One arm of the at-rest object dispatcher (reached from loc_144c when the object's move
 * command selects this direction). It is the mirror of the axis sibling loc_167f — the same
 * derive-a-row-then-route shape, but stepping the object the other way (its position offset
 * is subtracted here, added there) and with the boundary at the far end of the run:
 *
 *   - DEFERRED. If the object's frame is held off (its busy flag is set), the whole move is
 *     skipped and only the object's sprite-deferral record is rebuilt.
 *   - THE COMMON STEP. Otherwise it forces the object's sprite code for this step, turns its
 *     position minus the caller's offset into a tile row (counting rows down from the top of
 *     the map, one row per eight pixels), stores that row, and hands the step to the
 *     positioning front loc_14cd, which locates the cell and resolves the tile under it.
 *   - THE DIG ONE-SHOT. If that tile row is the boundary row AND the feature latch is pending,
 *     it consumes the latch, clears the pending dig spawn, arms the dig object's target phase,
 *     and builds the dig object's sprite record instead.
 *
 * Every exit tail-calls a builder/router whose whole result is in RAM, so this routine leaves
 * no register for its caller to read. The derived row is handed to loc_14cd directly (it is
 * the object's screen row); nothing is marshalled through registers. It stays loc_1493: its
 * callee loc_14cd and its sibling loc_167f are themselves still neutrally named (the row/goal
 * mechanics and the X-vs-Y axis labelling under the rotated display are only partly pinned),
 * so a single effect-verb here would over-claim.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1493.test.js.
 * GATE:     RAM-only over real captured attract dispatches (0x1493 runs 62x / 4000 frames via
 *           this move arm: the common step, plus one natural dig one-shot) + a crafted entry
 *           for the deferred arm the demo never produces and a crafted boundary-row dig
 *           one-shot. Excludes the dead stack scratch the still-oracle tails park below the
 *           entry stack pointer (the idiomatic handoffs are stack-free). Teeth: a wrong forced
 *           sprite code, and a dropped dig-object arming on the one-shot.
 * LIVE-OUT: memory-only — the forced sprite code, the derived tile row, and on the dig
 *           one-shot the consumed feature latch / cleared spawn state / armed dig state, plus
 *           everything the positioning front or the record builders write downstream. No
 *           register live-out (every exit tail-calls a memory-only routine).
 * NAMES:    OBJ_X, SPRITE_CODE, OBJ_TILE_ROW, FEATURE_TILE_LATCH, SPAWN_STATE, DIG_OBJ_STATE,
 *           CARVE_SEAM_LEFT (0x807e, the busy/defer flag this arm reads) from ram.js;
 *           the sprite code and map geometry are literals.
 */

import { OBJ_X, SPRITE_CODE, OBJ_TILE_ROW, FEATURE_TILE_LATCH, SPAWN_STATE, DIG_OBJ_STATE, CARVE_SEAM_LEFT } from "./ram.js";
import { u8 } from "../../../core/int.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { loc_14cd } from "./loc_14cd.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";

const STEP_SPRITE = 178; // sprite code forced for the object before this step
const TOP_ROW = 31; // the top tile row of the map; rows are counted down from here
const POSITION_BIAS = 3; // rounding bias folded into the position before it reduces to a tile row
const BOUNDARY_ROW = 22; // reaching this row with the feature latch pending fires the dig one-shot
const DIG_TARGET_STATE = 9; // the dig object's "done/target" phase the one-shot arms it to

export function loc_1493(m, offset = m.regs.e) {
  const { mem8 } = m;

  // Deferred: the object's frame is held off, so skip the move and just rebuild its
  // sprite-deferral record.
  if (mem8[CARVE_SEAM_LEFT] !== 0) return stageObjectSpriteRecord(m);

  // Force the object's sprite code for this step.
  mem8[SPRITE_CODE] = STEP_SPRITE;

  // Derive the tile row under the object: bias its position by minus the caller's offset plus
  // a rounding constant (the sum wraps within a byte), then count rows down from the top of
  // the map, one row per eight pixels.
  const row = TOP_ROW - (u8(mem8[OBJ_X] - offset + POSITION_BIAS) >> 3);
  mem8[OBJ_TILE_ROW] = row;

  // Any row but the boundary row, or the boundary row without the feature latch pending,
  // continues positioning the object through loc_14cd (which reads the row).
  if (row !== BOUNDARY_ROW || mem8[FEATURE_TILE_LATCH] === 0) {
    return loc_14cd(m, row);
  }

  // The boundary row reached with the feature latch pending: a one-shot. Consume the latch,
  // clear the pending dig spawn, arm the dig object's target phase, and build the dig record.
  mem8[FEATURE_TILE_LATCH] = 0;
  mem8[SPAWN_STATE] = 0;
  mem8[DIG_OBJ_STATE] = DIG_TARGET_STATE;
  return stageDigObjectSpriteRecord(m);
}
