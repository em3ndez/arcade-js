// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_4006 } from "./loc_4006.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { ANIM_SEQ_2D5D } from "./names.js";

const SIGN_FLAG = 0x15; //   bit0 chooses add (+) vs subtract (-) for the position delta
const SCRIPT_LO = 0x16; //   16-bit script cursor, low byte
const SCRIPT_HI = 0x17; //   16-bit script cursor, high byte
const STATE_FIELD = 0x02; // record state byte, bumped on the 0x88 opcode
const POS_LO = 0x03; //      16-bit horizontal position, low byte
const POS_HI = 0x04; //      16-bit horizontal position, high byte
const HOLD_FIELD = 0x11; //  frame-hold reseeded on the 0x88 opcode
const OP_RELOAD = 0xff; //   script byte: latch into the sign flag, keep scanning
const OP_ANIMATE = 0x88; //  script byte: bump state + arm the animation

/**
 * loc_2cb3 — hunter dispatch state 1: step the record's animation, then advance its
 * script cursor (rec+0x16:0x17). Leading 0xff bytes latch into the sign flag (rec+0x15);
 * a 0x88 byte bumps the state and arms an animation; any other byte is a magnitude added
 * to (rec+0x03:0x04) when the sign flag bit0 is set, else subtracted.
 *
 * LIVE-OUT: boolean true (the hunter-dispatch "normal" protocol the caller checks);
 * all effects otherwise land in the record's memory. No register is read back.
 */
export function loc_2cb3(m, rec = m.regs.ix) {
  const { mem8 } = m;

  loc_4006(m, rec); // step the animation sequence first

  let cursor = mem8[rec + SCRIPT_LO] | (mem8[rec + SCRIPT_HI] << 8);
  let op = mem8[cursor];
  while (op === OP_RELOAD) {
    mem8[rec + SIGN_FLAG] = op; // latch 0xff (sets bit0)
    cursor = u16(cursor + 1);
    op = mem8[cursor];
  }

  if (op === OP_ANIMATE) {
    mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1;
    setActorAnimation(m, rec, ANIM_SEQ_2D5D);
    mem8[rec + HOLD_FIELD] = 0x20;
    return true;
  }

  cursor = u16(cursor + 1); // step past the delta byte, then store the cursor back
  mem8[rec + SCRIPT_LO] = cursor;
  mem8[rec + SCRIPT_HI] = cursor >> 8;

  if (mem8[rec + SIGN_FLAG] & 0x01) {
    const sum = mem8[rec + POS_LO] + op;
    mem8[rec + POS_LO] = sum;
    if (sum > 0xff) mem8[rec + POS_HI] = mem8[rec + POS_HI] + 1; // carry into the high byte
  } else {
    const diff = mem8[rec + POS_LO] - op;
    mem8[rec + POS_LO] = diff;
    if (diff < 0) mem8[rec + POS_HI] = mem8[rec + POS_HI] - 1; // borrow from the high byte
  }
  return true;
}
