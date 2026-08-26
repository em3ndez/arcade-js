// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  EAGLE_STEP_COUNTER,
  EAGLE_STAGE_TIMERS,
  ROUND_COUNTER,
  SPEED_INDEX,
  EAGLE_TARGET_COLUMN_BIAS,
  EAGLE_REARM_TABLE_5922,
  EAGLE_REARM_TABLE_5985,
} from "./names.js";
import { loc_0020 } from "./loc_0020.js";
import { loc_57c3 } from "./loc_57c3.js";
/**
 * loc_57c6 — eagle sub-state stepper / re-arm.
 *
 * While the step counter is in 1..6 it advances: the counter bumps, then the first non-zero of the
 * three stage timers is decremented and its move direction+speed latched into the actor record
 * (rec+0x13 / rec+0x16). A zeroed or exhausted counter (0 or >=7) re-arms instead: the counter
 * resets to 1 and, per the round flag's bit0, one of two record tables is indexed by 3x a clamped
 * position, its three bytes copied into the stage timers, then the state head runs again.
 *
 * LIVE-OUT: none — the caller discards the return by popping its own frame; all effect is in memory.
 */
const COUNTER_LIMIT = 0x07; // counter 0 or >= this re-arms
const STAGE_MAX = 0x1f; // position clamps to this
const POSITION_CAP = 0x20; // position at or above this clamps

export function loc_57c6(m, ix = m.regs.ix) {
  const { mem8 } = m;

  const counter = mem8[EAGLE_STEP_COUNTER];
  if (counter !== 0 && counter < COUNTER_LIMIT) {
    mem8[EAGLE_STEP_COUNTER] = counter + 1; // bump the step counter

    if (mem8[EAGLE_STAGE_TIMERS] !== 0) {
      // stage 1 active
      mem8[EAGLE_STAGE_TIMERS] = mem8[EAGLE_STAGE_TIMERS] - 1;
      mem8[ix + 0x13] = 0x02;
      mem8[ix + 0x16] = 0x01;
      return;
    }
    if (mem8[EAGLE_STAGE_TIMERS + 1] !== 0) {
      // stage 2 active
      mem8[EAGLE_STAGE_TIMERS + 1] = mem8[EAGLE_STAGE_TIMERS + 1] - 1;
      mem8[ix + 0x13] = 0x01;
      mem8[ix + 0x16] = 0xc1;
      return;
    }
    if (mem8[EAGLE_STAGE_TIMERS + 2] === 0) return; // stage 3 idle
    // stage 3 active
    mem8[EAGLE_STAGE_TIMERS + 2] = mem8[EAGLE_STAGE_TIMERS + 2] - 1;
    mem8[ix + 0x16] = 0x41;
    return;
  }

  // re-arm
  mem8[EAGLE_STEP_COUNTER] = 0x01;
  let table;
  let position;
  if ((mem8[ROUND_COUNTER] & 0x01) === 0) {
    table = EAGLE_REARM_TABLE_5985;
    position = mem8[ROUND_COUNTER];
  } else {
    table = EAGLE_REARM_TABLE_5922;
    position = u8(mem8[SPEED_INDEX] + mem8[EAGLE_TARGET_COLUMN_BIAS]);
  }
  if (position >= POSITION_CAP) position = STAGE_MAX; // clamp

  // fetch the record: base + 3*position, then the three record bytes into the stage timers
  const [byte0, ptr] = loc_0020(m, table, 3 * position);
  mem8[EAGLE_STAGE_TIMERS] = byte0;
  mem8[EAGLE_STAGE_TIMERS + 1] = mem8[ptr + 1];
  mem8[EAGLE_STAGE_TIMERS + 2] = mem8[ptr + 2];

  return loc_57c3(m, 0xff, ix); // re-run the state head with a non-spawn marker
}
