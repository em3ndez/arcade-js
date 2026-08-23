// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0c45 } from "./loc_0c45.js";
import { loc_0020 } from "./loc_0020.js";
import { loc_1383 } from "./loc_1383.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { ROUND_COUNTER, ANIM_FRAME_COUNTER, ANIM_SEQ_TABLE_12FB, ANIM_TABLE_3838 } from "./names.js";
/**
 * loc_12d0 — table lookup + object-field compare/dispatch for the record at IX.
 *
 * The round counter's low bits pick a word from the sequence table; the animation-frame nibble
 * then indexes a target byte inside that word's row. The record's compare field is matched against
 * that target: equal hands off (tail) to the spawn dispatch; below the low bound the handler just
 * returns; otherwise it flags the record spawned and hands off (tail) to the animation setter.
 *
 * SEATING: BALANCED (the ret-below-bound WIREs); the equal and spawned branches are tail-jumps
 * forwarding the delegatee's result. LIVE-OUT: A — the spawn dispatch's result on the equal
 * branch, else the compare field itself; C — the lookup target; DE — the advanced table pointer
 * (the anim-table base on the spawned branch); all read back by a register-dispatched caller.
 */

const OBJ_FIELD = 0x06;
const SPAWNED_FLAG = 0x08;
const ROUND_MASK = 0x1f;
const FRAME_MASK = 0x0f;
const FIELD_MIN = 0x14; // below this the handler returns

export function loc_12d0(m, rec = m.regs.ix) {
  const { mem8 } = m;

  const index = (mem8[ROUND_COUNTER] & ROUND_MASK) >> 2;
  const row = loc_0c45(m, index, ANIM_SEQ_TABLE_12FB); // row = table[index]
  const [target] = loc_0020(m, row, mem8[ANIM_FRAME_COUNTER] & FRAME_MASK); // byte at row + frame
  const field = mem8[rec + OBJ_FIELD];
  const advancedPtr = u16(ANIM_SEQ_TABLE_12FB + ((index << 1) & 0xff) + 1);

  if (field === target) return (m.regs.c = target, m.regs.de = advancedPtr, loc_1383(m)); // tail: spawn dispatch
  if (field < FIELD_MIN) return (m.regs.c = target, m.regs.de = advancedPtr, m.regs.a = field);
  mem8[rec + SPAWNED_FLAG] = 0x01;
  setActorAnimation(m, rec, ANIM_TABLE_3838); // point the record at the animation
  return (m.regs.c = target, m.regs.de = ANIM_TABLE_3838, m.regs.a = field); // spawned: DE = anim-table base
}
