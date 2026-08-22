// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_142c } from "./loc_142c.js";
import { SPRITE_OBJECT_TABLE, ANIM_FRAME_COUNTER, ANIM_SEQ_3988 } from "./names.js";
/**
 * loc_13bc — find a free slot in the sprite-object table and spawn a child actor into it.
 *
 * Scans the five fixed-stride slots for one whose first two bytes have bit0 clear (free). If none
 * is free it leaves the last scanned pair's rotate-right value in A and returns. Otherwise it bumps
 * the wrapping animation-frame counter (skipping zero), stamps it into the parent record, points
 * the parent at a fixed animation vector, seeds the kind and timer fields, then hands the parent,
 * the found slot and the counter to the child-spawn initialiser as a tail call.
 *
 * LIVE-OUT: A. On the spawn path A is the initialiser's result; on the no-free path it is the last
 * scanned pair's rotate-right byte. A register-dispatched caller can read it back.
 */

const SLOT_COUNT = 5;
const SLOT_STRIDE = 0x18;
const ANIM_TIMER = 0x28; //  parent field +0x11 seed
const RECORD_KIND = 0x04; // parent field +0x02 seed

export function loc_13bc(m, parent = m.regs.ix) {
  const { mem8 } = m;

  let slot = SPRITE_OBJECT_TABLE;
  let found = null;
  let lastPair = 0;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const bits = mem8[slot] | mem8[slot + 1];
    lastPair = ((bits >> 1) | ((bits & 0x01) << 7)) & 0xff; // rotate right: bit0 -> bit7
    if ((bits & 0x01) === 0) { found = slot; break; } //         bit0 clear -> free slot
    slot = u16(slot + SLOT_STRIDE);
  }
  if (found === null) return (m.regs.a = lastPair); // nothing free

  let counter = (mem8[ANIM_FRAME_COUNTER] + 1) & 0xff;
  if (counter === 0) counter = 0x01; // the wrap skips zero
  mem8[ANIM_FRAME_COUNTER] = counter;

  mem8[parent + 0x14] = counter;
  mem8[parent + 0x0c] = ANIM_SEQ_3988;
  mem8[parent + 0x0d] = (ANIM_SEQ_3988 >> 8);
  mem8[parent + 0x0e] = 0x00;
  mem8[parent + 0x11] = ANIM_TIMER;
  mem8[parent + 0x02] = RECORD_KIND;

  return loc_142c(m, parent, found, counter);
}
