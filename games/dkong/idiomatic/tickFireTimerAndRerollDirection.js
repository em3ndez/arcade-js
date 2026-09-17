// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickFireTimerAndRerollDirection — tick one fire's periodic timer; on expiry reload it and
 * re-roll the object's travel direction on a random bit. The object record arrives in regs.ix.
 *
 * LIVE-OUT: memory-only — the record's timer and state fields.
 */

import { RANDOM } from "./names.js";

const TIMER = 0x16; // object-record field: periodic countdown
const STATE = 0x0d; // object-record field: 0/1 phase, advanced on a random beat
const RELOAD = 43;  // the shared decrement then leaves 42

export function tickFireTimerAndRerollDirection(m, ix = m.regs.ix) {
  const { mem8 } = m;

  const record = ix;
  const timerAddr = (record + TIMER) & 0xffff;
  const stateAddr = (record + STATE) & 0xffff;

  if (mem8[timerAddr] === 0) {
    mem8[timerAddr] = RELOAD;
    mem8[stateAddr] = 0;
    if ((mem8[RANDOM] & 0x01) !== 0) {
      mem8[stateAddr] = 1;
    }
  }

  // Every path converges here: tick the (possibly reloaded) timer down by one.
  mem8[timerAddr] = mem8[timerAddr] - 1;
}
