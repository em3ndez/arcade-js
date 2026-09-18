// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageDigObjectSpriteRecord — compose the dig object's sprite so it draws at its cell.
 *
 * The dig/carve object's appearance lives in a little field block: its target column and row,
 * the sprite code for its current phase, and a colour/priority attribute. This routine copies
 * those four fields into the dig object's slot of the sprite staging buffer — the block the
 * per-frame video service streams to hardware sprite RAM — so the object draws at its cell.
 * The two coordinate ends are pulled apart by the fixed cabinet pixel offset SPRITE_COORD_BIAS:
 * the leading column byte has it subtracted, the trailing row byte added (0 in normal play, so
 * the ends usually copy straight across, and both biased ends wrap within a byte). Every event
 * handler funnels through here, then flows on into the background-element update to the caller.
 */

import {
  HAZARD_X,
  HAZARD_STATE,
  HAZARD_TYPE,
  HAZARD_Y,
  SPRITE_COORD_BIAS,
  SPRITE_STAGING_BASE,
} from "./names.js";
import { advanceChamberCreature } from "./advanceChamberCreature.js";

const DIG_RECORD = SPRITE_STAGING_BASE + 8;

export function stageDigObjectSpriteRecord(m) {
  const { mem8 } = m;

  const offset = mem8[SPRITE_COORD_BIAS];

  // Copy the four fields into the staging slot (each store truncates to a byte, so ends wrap).
  mem8[DIG_RECORD] = mem8[HAZARD_X] - offset; // leading: column, offset removed
  mem8[DIG_RECORD + 1] = mem8[HAZARD_STATE]; // sprite code for the current phase
  mem8[DIG_RECORD + 2] = mem8[HAZARD_TYPE];
  mem8[DIG_RECORD + 3] = mem8[HAZARD_Y] + offset; // trailing: row, offset added

  // Continue into the per-frame background-element update; its return unwinds to our caller.
  return advanceChamberCreature(m);
}
