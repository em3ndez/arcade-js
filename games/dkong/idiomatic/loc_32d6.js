// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_32d6 — services one object record (pointer in IX). Runs a down-counter in field +0x1C; the
 * counter only survives when MARIO_Y clears the object's limit (+0x0F) on the pass it drains and
 * the arm flag (+0x1D) is set. Every other path clears the exit fields and ticks the periodic timer.
 *
 * LIVE-OUT: memory-only.
 */

import { MARIO_Y, OBJ_STATE } from "./names.js";
import { tickFireTimerAndRerollDirection } from "./tickFireTimerAndRerollDirection.js";

const DWELL_COUNTER = 0x1c; // interval down-counter; reloads to 0xFF on the pass gate
const ARM_FLAG = 0x1d;      // == 1 arms the position-compare branch; then disarmed
const LIMIT_FIELD = 0x0f;   // compared against MARIO_Y (borrow => below)
const EXIT_FIELD_19 = 0x19; // cleared to 0 alongside the counter on the tick-out branches

export function loc_32d6(m, record = m.regs.ix) {
  const { mem8 } = m;
  const at = (off) => (record + off) & 0xffff;

  const clearExitAndTick = () => {
    mem8[at(EXIT_FIELD_19)] = 0;
    mem8[at(DWELL_COUNTER)] = 0;
    tickFireTimerAndRerollDirection(m);
  };

  const counter = mem8[at(DWELL_COUNTER)];
  if (counter !== 0) {
    const dec = (counter - 1) & 0xff;
    mem8[at(DWELL_COUNTER)] = dec;
    if (dec !== 0) {
      mem8[at(OBJ_STATE)] = 0;
      return;
    }
    clearExitAndTick();
    return;
  }

  if (mem8[at(ARM_FLAG)] !== 1) {
    tickFireTimerAndRerollDirection(m);
    return;
  }

  mem8[at(ARM_FLAG)] = 0;
  if (mem8[MARIO_Y] < mem8[at(LIMIT_FIELD)]) {
    clearExitAndTick();
    return;
  }

  // At or above the limit: reload rather than drain.
  mem8[at(DWELL_COUNTER)] = 0xff;
  mem8[at(OBJ_STATE)] = 0;
}
