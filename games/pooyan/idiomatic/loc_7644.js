// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_4006 } from "./loc_4006.js";
import { SHARED_PHASE_COUNTDOWN } from "./names.js";

const STATE_FIELD = 0x02;
const FRAME_FLOOR = 0x06; //  frame counter still animating while >= this
const RESET_TIMER = 0x20; //  forced into the shared phase countdown on reset
const RESET_COUNT = 0x0e; //  records whose state byte is forced active on reset
const RESET_STRIDE = 0x18;
const STATE_ACTIVE = 0x01;

/**
 * loc_7644 — animation-tick state 0 (dissolved caller-skip).
 *
 * Inactive entries ((rec+0)==0) keep the walk going. A live entry steps its animation, advances the
 * (rec+5) sub-position by subtracting (rec+9) — rolling the (rec+6) frame counter down on borrow —
 * and keeps animating while that counter is still >= 6. Once it drops below 6 it reloads the shared
 * phase countdown, forces 14 records' state byte back to active, and aborts the walk.
 *
 * LIVE-OUT: none in registers — the caller reads back only the boolean (true = keep walking, false =
 * abort). Memory: the stepped animation, (rec+5)/(rec+6), the countdown, and the reset state bytes.
 */
export function loc_7644(m, ix = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[ix + 0x00] === 0) return true; // inactive -> keep walking

  loc_4006(m, ix); // step this entry's animation

  const cur5 = mem8[ix + 0x05];
  const cur9 = mem8[ix + 0x09];
  if (cur5 < cur9) mem8[ix + 0x06] = mem8[ix + 0x06] - 1; // borrow rolls the frame counter
  mem8[ix + 0x05] = cur5 - cur9;

  if (mem8[ix + 0x06] >= FRAME_FLOOR) return true; // still animating

  mem8[SHARED_PHASE_COUNTDOWN] = RESET_TIMER;
  let rec = ix;
  for (let n = 0; n < RESET_COUNT; n++) {
    mem8[rec + STATE_FIELD] = STATE_ACTIVE;
    rec = u16(rec + RESET_STRIDE);
  }
  return false; // frame elapsed -> abort the walk (caller-skip)
}
