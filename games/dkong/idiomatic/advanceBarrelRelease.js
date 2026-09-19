// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBarrelRelease — frame-gated step of the barrel string/sprite renderer. Acts only
 * every 24th frame via a down-counter; on the acting frame it reads an animation sub-counter,
 * copies the selected animation-table record into the sprite-object block, steps the sub-counter,
 * and renders the next character (or restarts the source string) per bit 0 of the slot-claim mode.
 *
 * LIVE-OUT: memory-only — the gate and sub-counter cells, plus everything the copy and the two
 * render tails write.
 */

import { u16 } from "../../../core/int.js";
import {
  ANIM_PACE_COUNTER,
  BARREL_CLAIM_MODE,
  loc_638f,
  SPRITE_OBJ_ANIM_FRAME_TABLE,
} from "./names.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { loc_2d51 } from "./loc_2d51.js";
import { loc_2d83 } from "./loc_2d83.js";

const RECORD_STRIDE = 40;      // bytes per table record (ten sprite records of four bytes)

export function advanceBarrelRelease(m) {
  const { regs, mem8 } = m;

  const gate = (mem8[ANIM_PACE_COUNTER] - 1) & 0xff;
  mem8[ANIM_PACE_COUNTER] = gate;
  if (gate !== 0) return;

  mem8[ANIM_PACE_COUNTER] = 0x18;

  const counter = mem8[loc_638f];
  if (counter === 0) return loc_2d51(m);

  // bit0 of the slot-claim mode selects the record: the sub-counter itself, or one less.
  let index = counter;
  if ((mem8[BARREL_CLAIM_MODE] & 0x01) === 0) {
    index = (index - 1) & 0xff;
  }
  const source = u16(SPRITE_OBJ_ANIM_FRAME_TABLE + ((index * RECORD_STRIDE) & 0xff));

  loadSpriteObjectBlock(m, source);

  const stepped = (mem8[loc_638f] - 1) & 0xff;
  mem8[loc_638f] = stepped;
  if (stepped !== 0) return loc_2d51(m);

  mem8[ANIM_PACE_COUNTER] = 0x01;
  if ((mem8[BARREL_CLAIM_MODE] & 0x01) !== 0) return loc_2d83(m);
  return loc_2d51(m);
}
