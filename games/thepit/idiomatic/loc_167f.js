// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_167f — advance the tracked object one step along the row axis: derive its tile
 * row and route on it, firing the dig one-shot at the trigger row.  ROM 0x167f.
 *
 * Reached from the per-frame object dispatch when the object's move command selects the
 * row axis. It is handed the caller's position offset (the object's per-frame step, held
 * in a machine register) and drives three outcomes:
 *
 *   - DEFERRED. If the object's frame is held off (its overlap flag is set), the whole
 *     move is skipped and only the object's sprite-deferral record is rebuilt.
 *   - THE COMMON STEP. Otherwise it pre-loads the object's sprite code, turns its
 *     position + the caller's offset into a tile row (counting rows up from the bottom
 *     of the map, one row per eight pixels), stores that row, and hands the step to the
 *     horizontal-step router, which walks the object on / resolves the terrain it enters.
 *   - THE DIG ONE-SHOT. If that tile row is the trigger row AND the feature latch is
 *     pending, it consumes the latch, clears the pending dig spawn, arms the dig object's
 *     target phase, and builds the dig object's sprite record instead.
 *
 * Every exit tail-calls a builder/router whose whole result is in RAM, so this routine
 * leaves no register for its caller to read. It stays loc_167f: its main callee loc_16b9
 * and its axis sibling loc_1493 are themselves still neutrally named (the row/goal
 * mechanics and the X-vs-Y axis labelling under the rotated display are only partly
 * pinned), so a single effect-verb here would over-claim.
 *
 * Memory-equivalent to the frozen oracle — equivalence-167f.test.js.
 * GATE:     RAM-only over real captured attract dispatches (0x167f runs during the demo
 *           via the row-axis move arm, all reaching the common step) + crafted entries for
 *           the deferred arm, the trigger-row-latch-clear arm, and the dig one-shot arm the
 *           demo never produces. Excludes the dead stack scratch the still-oracle tails park
 *           below the entry stack pointer (the idiomatic handoffs are stack-free). Teeth: a
 *           wrong sprite code, and a dropped dig-object arming on the one-shot.
 * LIVE-OUT: memory-only — the pre-loaded sprite code, the derived tile row, and on the dig
 *           one-shot the consumed feature latch / cleared spawn state / armed dig state,
 *           plus everything the horizontal-step router or the record builders write
 *           downstream. No register live-out (every exit tail-calls a memory-only routine).
 * NAMES:    OBJ_X, SPRITE_CODE, OBJ_TILE_ROW, FEATURE_TILE_LATCH, SPAWN_STATE, DIG_OBJ_STATE,
 *           CARVE_SEAM_RIGHT (0x807f, the overlap/defer flag this arm reads) from ram.js;
 *           the sprite code and map geometry are literals.
 */

import { OBJ_X, SPRITE_CODE, OBJ_TILE_ROW, FEATURE_TILE_LATCH, SPAWN_STATE, DIG_OBJ_STATE, CARVE_SEAM_RIGHT } from "./ram.js";
import { u8 } from "../../../core/int.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";
import { loc_16b9 } from "./loc_16b9.js";
import { stageDigObjectSpriteRecord } from "./stageDigObjectSpriteRecord.js";

const DEFAULT_SPRITE = 0x32; // sprite code pre-loaded for the object before this step
const BOTTOM_ROW = 31; // the bottom tile row of the map; rows are counted up from here
const POSITION_BIAS = 11; // rounding bias folded into the position before it reduces to a tile row
const TRIGGER_ROW = 7; // reaching this row with the feature latch pending fires the dig one-shot
const DIG_TARGET_STATE = 9; // the dig object's "done/target" phase the one-shot arms it to

export function loc_167f(m, offset = m.regs.e) {
  const { mem8 } = m;

  // Deferred: the object's frame is held off, so skip the move and just rebuild its
  // sprite-deferral record.
  if (mem8[CARVE_SEAM_RIGHT] !== 0) return stageObjectSpriteRecord(m);

  // Pre-load the object's sprite code for this step.
  mem8[SPRITE_CODE] = DEFAULT_SPRITE;

  // Derive the tile row under the object: bias its position by the caller's offset plus a
  // rounding constant (the sum wraps within a byte), then count rows up from the bottom of
  // the map, one row per eight pixels.
  const rowIndex = BOTTOM_ROW - (u8(mem8[OBJ_X] + offset + POSITION_BIAS) >> 3);
  mem8[OBJ_TILE_ROW] = rowIndex;

  // Any row but the trigger row, or the trigger row without the feature latch pending,
  // continues the object's step through the horizontal-step router (which reads the row).
  if (rowIndex !== TRIGGER_ROW || mem8[FEATURE_TILE_LATCH] === 0) {
    return loc_16b9(m, rowIndex);
  }

  // The trigger row reached with the feature latch pending: a one-shot. Consume the latch,
  // clear the pending dig spawn, arm the dig object's target phase, and build its record.
  mem8[FEATURE_TILE_LATCH] = 0;
  mem8[SPAWN_STATE] = 0;
  mem8[DIG_OBJ_STATE] = DIG_TARGET_STATE;
  return stageDigObjectSpriteRecord(m);
}
