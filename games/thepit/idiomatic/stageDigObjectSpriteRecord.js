// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageDigObjectSpriteRecord — compose the dig object's sprite so it draws at its cell.  ROM 0x2bd3.
 *
 * The dig/carve object's on-screen appearance lives in a little field block: where it
 * sits (its target column and row), the sprite code that shows its current phase, and a
 * colour/priority attribute. This routine copies those four fields into the dig object's
 * slot of the sprite staging buffer — the block the per-frame video service streams to
 * hardware sprite RAM every frame — so the object is drawn at its cell. The two
 * coordinate ends are pulled apart by the fixed cabinet pixel offset: the leading column
 * byte has the offset subtracted, the trailing row byte has it added (that offset is 0 in
 * normal play, so the ends usually copy straight across). Both biased ends wrap within a
 * byte.
 *
 * Every dig/carve event handler funnels through here to publish the object, then the
 * routine flows straight on into the per-frame background-element update, which finishes
 * the frame's sprite chain and unwinds to this routine's caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2bd3.test.js.
 * GATE:     crafted-entry — never dispatched in a boot/attract run (the demo spawns no dig
 *           object, so its fields sit at 0), so it is gated on real captured attract states
 *           plus a crafted arithmetic sweep of the four fields + the offset across the wrap
 *           edges. It reads all its inputs from RAM, so any realistic state is a valid entry.
 * LIVE-OUT: memory-only — the four record bytes, then whatever the background update leaves.
 *           The residual value registers are dead ABI; no caller reads one back from here.
 * NAMES:    HAZARD_X, HAZARD_STATE, HAZARD_TYPE, HAZARD_Y, SPRITE_COORD_BIAS,
 *           SPRITE_STAGING_BASE from ram.js. The background-update tail 0x2f71 is the
 *           decompiled advanceChamberCreature, called directly.
 */

import {
  HAZARD_X,
  HAZARD_STATE,
  HAZARD_TYPE,
  HAZARD_Y,
  SPRITE_COORD_BIAS,
  SPRITE_STAGING_BASE,
} from "./ram.js";
import { advanceChamberCreature } from "./advanceChamberCreature.js";

// The dig object occupies sprite slot 2 (records are 4 bytes each) of the staging buffer.
const DIG_RECORD = SPRITE_STAGING_BASE + 8;

export function stageDigObjectSpriteRecord(m) {
  const { mem8 } = m;

  const offset = mem8[SPRITE_COORD_BIAS];

  // Copy the dig object's four fields into its sprite-staging slot, pulling the two
  // coordinate ends apart by the cabinet offset. Each store truncates to a byte, so the
  // biased ends wrap.
  mem8[DIG_RECORD] = mem8[HAZARD_X] - offset; // leading: column, offset removed
  mem8[DIG_RECORD + 1] = mem8[HAZARD_STATE]; // sprite code for the object's current phase
  mem8[DIG_RECORD + 2] = mem8[HAZARD_TYPE]; // colour + priority attribute
  mem8[DIG_RECORD + 3] = mem8[HAZARD_Y] + offset; // trailing: row, offset added

  // Continue into the per-frame background-element update (advanceChamberCreature, ROM 0x2f71),
  // called directly now that it is decompiled; its return unwinds to our caller.
  return advanceChamberCreature(m);
}
