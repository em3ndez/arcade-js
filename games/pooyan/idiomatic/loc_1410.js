// SPDX-License-Identifier: GPL-3.0-only
import { STAGE_COUNTDOWN } from "./names.js";
import { loc_141c } from "./loc_141c.js";
import { loc_1399 } from "./loc_1399.js";
/**
 * loc_1410 — stash the actor's step value, then branch on the stage countdown.
 *
 * Writes the value into the record at rec+5 and latches it — it becomes the count the
 * timer-dispatch path reads. If the stage countdown is below three, control tails into the
 * state-timer dispatch (which reads the latch); otherwise it tails into the spawn/queue gate.
 * Both exits return the delegate's result directly.
 */
export function loc_1410(m, rec = m.regs.ix, value = m.regs.a) {
  const { mem8 } = m;
  mem8[rec + 0x05] = value; // stash + latch the step value
  if (mem8[STAGE_COUNTDOWN] < 0x03) return loc_1399(m, rec, value); // timer-dispatch path
  return loc_141c(m, rec); // spawn/queue gate
}
