// SPDX-License-Identifier: GPL-3.0-only
import { loc_34, loc_b2 } from "./names.js";
import { loc_3046 } from "./loc_3046.js";

/**
 * loc_303e (ROM 0x303e) -- the middle link of the path-accumulator fall-through chain (reached from
 * loc_3037, continuing into loc_3046). It resets the per-slot bookkeeping the spawn machinery reads:
 * it arms the timer cell $b2 and marks slot X's row byte free. The $34 bank is the countdown-timer
 * array serviceTimerBank sweeps; writing 0xff (high bit set) parks this slot's row as "not placed"
 * so the scheduler treats it as available. Live-out: $b2 = 0x13, ($34+x) = 0xff. [code]
 */
export function loc_303e(m, x = m.regs.x) {
  const { mem8 } = m;
  // Arm the timer cell $b2 with 0x13 -- the reload value this slot counts down from next.
  mem8[loc_b2] = 0x13; // arm the timer cell
  // Free slot X's row byte in the $34 timer/row bank: 0xff (high bit set) reads as "slot empty".
  mem8[(loc_34 + x) & 0xff] = 0xff; // free slot X's row byte
  // Fall through into the zero-page fixup + spawn-cadence tail.
  return loc_3046(m); // fall through
}
