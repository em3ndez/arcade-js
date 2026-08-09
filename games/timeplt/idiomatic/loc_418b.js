// SPDX-License-Identifier: GPL-3.0-only
/** loc_418b — service one live slot of the per-slot object sweep: fly the slot's object a step along
 * its velocity, retire it if that step took it past the retire line, tick the slot countdown one record in, then close the turn. LIVE-OUT: memory. */
import { closeOneTurnOfTheSlotSweep } from "./closeOneTurnOfTheSlotSweep.js";
import { loc_3e6c } from "./loc_3e6c.js";

const COUNTDOWN_OFFSET = 0x0e;

export function loc_418b(m) {
  loc_3e6c(m);
  const countdown = (m.regs.ix + COUNTDOWN_OFFSET) & 0xffff;
  m.mem8[countdown] = m.mem8[countdown] - 1;
  return closeOneTurnOfTheSlotSweep(m);
}
