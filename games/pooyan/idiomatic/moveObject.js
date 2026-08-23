// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { loc_0c45 } from "./loc_0c45.js";
import { loc_0020 } from "./loc_0020.js";
import { queueSoundCommand05 } from "./queueSoundCommand05.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  ARM_ANIM_TABLE,
  INTEGRITY_GUARD_TABLE_0BB3,
  TAMPER_STRIKES_OBJMOVE,
} from "./names.js";
/**
 * moveObject — active-object mover, rst-28 state 1.
 *
 * Refreshes the record's animation, then steps the position (rec+3) by the signed speed
 * (rec+0x0a), borrowing the sub-position (rec+4) on underflow. While the sub-position's low 5 bits stay
 * >= 9 it returns; when they drop below 9 the object crosses into the next cell: advance the state
 * (rec+2), reload the frame timer (rec+0x11)=0x18, enqueue sound cmd 5 (queueSoundCommand05), set the
 * sprite animation from ARM_ANIM_TABLE[rec+0x17] (via setActorAnimation), then run a 5-byte
 * program-image checksum guard; a miss bumps the tamper counter.
 *
 * LIVE-OUT: none — a void per-object step; its dispatch callers read nothing back.
 */
export function moveObject(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec); // step the animation sequence

  const speed = mem8[rec + 0x0a];
  const pos = mem8[rec + 0x03];
  if (pos < ((0 - speed) & 0xff)) mem8[rec + 0x04] = mem8[rec + 0x04] - 1; // underflow borrow
  mem8[rec + 0x03] = pos + speed; // mem8 write truncates to 8 bits

  if ((mem8[rec + 0x04] & 0x1f) >= 0x09) return; // not across a cell yet

  mem8[rec + 0x02] = mem8[rec + 0x02] + 1; // advance state
  mem8[rec + 0x11] = 0x18; // reload the frame timer

  queueSoundCommand05(m); // enqueue sound command 5

  setActorAnimation(m, rec, loc_0c45(m, mem8[rec + 0x17], ARM_ANIM_TABLE)); // store the animation pointer

  let acc = 0; // 5-byte checksum guard; rst-20 serves only as its 16-bit add (fetched byte discarded)
  for (let i = 0; i < 5; i++) {
    const [, next] = loc_0020(m, acc, mem8[INTEGRITY_GUARD_TABLE_0BB3 + i] & 0x1f);
    acc = next;
  }
  if ((((acc & 0xff) + ((acc >> 8) & 0xff) + 0xc7) & 0xff) === 0) return; // guard clear
  mem8[TAMPER_STRIKES_OBJMOVE] = mem8[TAMPER_STRIKES_OBJMOVE] + 1; // mem8 write truncates to 8 bits
}
