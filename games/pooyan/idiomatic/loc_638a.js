// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { queueSoundCommand07 } from "./queueSoundCommand07.js";
import { loc_0038 } from "./loc_0038.js";
import {
  FLIP_SCREEN_FLAG,
  OBJ_HIT_FLAG_I0,
  OBJ_HIT_FLAG_I1,
  ANIM_SEQ_63FB,
  HUNTER_SPAWN_DISPLAY_CMD,
} from "./names.js";
/**
 * loc_638a — scan a run of collision slots for one close to the actor box; on the first hit
 * claim its record and spawn.
 *
 * Each pass pairs a coordinate slot (stride 4; X at +0, Y at +2) with a record (stride 0x18;
 * presence byte at +0). Empty records are skipped. The slot X is biased +5 upright / -2 flipped
 * and the slot Y by a fixed margin; a hit needs both the horizontal and vertical gap versus the
 * actor box under the proximity limit. On a hit the record is stamped alive (state bytes + a
 * teardown countdown), the interrupt-parity hit flag is raised, the record is pointed at its
 * spawn animation, and a tile + display command are queued. Otherwise both pointers advance and
 * the scan repeats until the counter runs out.
 *
 * LIVE-OUT: returns a boolean — true = scan exhausted (no hit), false = a hit was claimed and
 * the caller's scan must abort. Memory-only otherwise.
 */

const PROXIMITY_LIMIT = 0x06; // hit requires both |dx| and |dy| strictly below this
const Y_MARGIN = 0x08; //        vertical bias added to both slot and actor Y
const X_BIAS_UPRIGHT = 0x05;
const X_BIAS_FLIPPED = 0xfe; //  -2 when the screen is flipped
const COORD_STRIDE = 0x04;
const REC_STRIDE = 0x18;

/** Absolute value of an 8-bit subtraction result given whether the subtract borrowed. */
function absDiff(raw, borrow) {
  return borrow ? (-raw) & 0xff : raw;
}

export function loc_638a(m, coord = m.regs.ix, count = m.regs.b, rec = m.regs.hl, box = m.regs.iy, ireg = m.regs.i) {
  const { mem8 } = m;
  let coordPtr = coord;
  let recPtr = rec;
  let remaining = count;

  for (;;) {
    if (mem8[recPtr] !== 0) {
      const xBias = mem8[FLIP_SCREEN_FLAG] !== 0 ? X_BIAS_UPRIGHT : X_BIAS_FLIPPED;
      const slotX = (mem8[coordPtr] + xBias) & 0xff;
      const slotY = (mem8[coordPtr + 2] + Y_MARGIN) & 0xff;
      const actorX = mem8[box];
      const dx = absDiff((actorX - slotX) & 0xff, actorX < slotX);
      if (dx < PROXIMITY_LIMIT) {
        const actorY = (mem8[box + 2] + Y_MARGIN) & 0xff;
        const dy = absDiff((actorY - slotY) & 0xff, actorY < slotY);
        if (dy < PROXIMITY_LIMIT) {
          mem8[recPtr + 0x00] = 0x00; // stamp the claimed record alive
          mem8[recPtr + 0x01] = 0x01;
          mem8[recPtr + 0x02] = 0x02;
          mem8[recPtr + 0x11] = 0x28;
          mem8[ireg !== 0 ? OBJ_HIT_FLAG_I1 : OBJ_HIT_FLAG_I0] = 0x01; // interrupt parity picks the flag
          setActorAnimation(m, recPtr, ANIM_SEQ_63FB);
          queueSoundCommand07(m);
          loc_0038(m, HUNTER_SPAWN_DISPLAY_CMD);
          return false; // hit claimed — abort the caller's scan
        }
      }
    }
    coordPtr = u16(coordPtr + COORD_STRIDE);
    recPtr = u16(recPtr + REC_STRIDE);
    remaining = (remaining - 1) & 0xff;
    if (remaining === 0) return true; // scan exhausted, no hit
  }
}
