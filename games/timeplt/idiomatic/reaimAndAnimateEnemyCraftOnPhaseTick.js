// SPDX-License-Identifier: GPL-3.0-only
/** reaimAndAnimateEnemyCraftOnPhaseTick — service one enemy-craft slot chosen by the packed-decimal life phase. On the 00s and
 * 30s tenths, take the tenth's units digit as a slot (only 0-6, and only when its record head reads
 * occupied), advance that record's shape animation, and unless its state byte is 0x10 re-aim its
 * heading at a point the state byte indexes out of a small aim table (state 0x11 aims at the table
 * base, stores the heading a half-turn on, and resets the record to state 0x10). On every other
 * tenth lay out the six-point sprite object instead. LIVE-OUT: memory-only. */

import { u8 } from "../../../core/int.js";
import { loc_326c } from "./loc_326c.js";
import { stepShapeAnimation } from "./stepShapeAnimation.js";
import { headingToward } from "./headingToward.js";
import { offsetAddress } from "./offsetAddress.js";

const PHASE = 0xad05;
const RECORD_BASE = 0xa850;
const ENTRY_BASE = 0xaa1a;
const AIM_POINTS = 0xac65;
const SLOT_COUNT = 7;
const OCCUPIED = 0xff;
const HELD = 0x10;
const REAIM_THEN_HOLD = 0x11;
const TENTHS_00 = 0x00;
const TENTHS_30 = 0x30;

export function reaimAndAnimateEnemyCraftOnPhaseTick(m) {
  const { regs, mem8 } = m;
  const phase = mem8[PHASE];
  regs.c = phase;

  const tens = phase & 0xf0;
  if (tens !== TENTHS_00 && tens !== TENTHS_30) return loc_326c(m);

  const slot = phase & 0x0f;
  if (slot >= SLOT_COUNT) return;
  const record = RECORD_BASE + slot * 16;
  const entry = ENTRY_BASE + slot * 2;
  regs.ix = record;
  regs.iy = entry;
  if (mem8[record] !== OCCUPIED) return;

  stepShapeAnimation(m);

  const state = mem8[record + 8];
  if (state === HELD) return;

  if (state === REAIM_THEN_HOLD) {
    regs.hl = AIM_POINTS;
    headingToward(m);
    mem8[record + 1] = u8(regs.a + 0x80);
    mem8[record + 8] = HELD;
    mem8[record + 9] = 0x00;
    return;
  }

  regs.a = u8(state + state);
  regs.hl = AIM_POINTS;
  offsetAddress(m);
  headingToward(m);
  mem8[record + 1] = regs.a;
}
