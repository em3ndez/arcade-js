// SPDX-License-Identifier: GPL-3.0-only
import {
  SPRITE_OBJECT_TABLE,
  FRAME_COUNTER,
  ACTOR_TAMPER_CKSUM_TOP,
  SIGNATURE_MISMATCH_FLAG,
} from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { u16 } from "../../../core/int.js";
/**
 * advanceActorStateOnTimerWithTamperCheck — actor state handler (dispatch target) with an embedded tamper check.
 *
 * It runs the animation player for the record based at IX, then counts a per-record timer down;
 * while it is non-zero it returns. On expiry it advances the record's sub-state and clears one
 * status bit, then acts only when the record pointer has reached the object-table band (its high
 * byte, then its low byte, at or above the band base). In-band it decrements two record fields,
 * and only when the global frame gate is clear it folds a fixed program block backward to a
 * terminator (an 8-bit wrapping sum with a separate carry tally); if the folded result keeps any
 * of the masked bits it bumps the tamper counter.
 *
 * LIVE-OUT: memory only — a dispatched handler whose scratch registers no caller reads.
 */

const RECORD_TIMER = 0x11;
const RECORD_SUBSTATE = 0x02;
const RECORD_STATUS = 0x08;
const RECORD_FIELD_A = 0x04;
const RECORD_FIELD_B = 0x06;
const CKSUM_TERMINATOR = 0x1a;
const RESULT_MASK = 0x9e;

export function advanceActorStateOnTimerWithTamperCheck(m, ix = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, ix); // run the animation player for this record

  const timer = (mem8[ix + RECORD_TIMER] - 1) & 0xff;
  mem8[ix + RECORD_TIMER] = timer;
  if (timer !== 0) return; // timer still running

  mem8[ix + RECORD_SUBSTATE] = mem8[ix + RECORD_SUBSTATE] + 1;
  mem8[ix + RECORD_STATUS] = mem8[ix + RECORD_STATUS] & ~0x01;

  // Per-byte reach test (high byte then low byte) against the object-table band base.
  if (((ix >> 8) & 0xff) < ((SPRITE_OBJECT_TABLE >> 8) & 0xff)) return;
  if ((ix & 0xff) < (SPRITE_OBJECT_TABLE & 0xff)) return;

  mem8[ix + RECORD_FIELD_A] = mem8[ix + RECORD_FIELD_A] - 1;
  mem8[ix + RECORD_FIELD_B] = mem8[ix + RECORD_FIELD_B] - 1;

  if (mem8[FRAME_COUNTER] !== 0) return; // frame gate not open

  let sum = 0;
  let carries = 0;
  let ptr = ACTOR_TAMPER_CKSUM_TOP;
  for (;;) {
    const total = sum + mem8[ptr];
    ptr = u16(ptr - 1);
    sum = total & 0xff;
    if (total > 0xff) carries = (carries + 1) & 0xff;
    if (mem8[ptr] === CKSUM_TERMINATOR) break;
  }

  if (((carries + sum) & RESULT_MASK) === 0) return; // clean
  mem8[SIGNATURE_MISMATCH_FLAG] = mem8[SIGNATURE_MISMATCH_FLAG] + 1;
}
