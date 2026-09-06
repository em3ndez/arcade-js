// SPDX-License-Identifier: GPL-3.0-only
// Object animation sub-state dispatcher: reads the object record's sub-state field and tail-calls the
// matching per-phase animation handler. The handler's result is returned unchanged, so this behaves as a
// tail dispatch — the selected handler's own return is the dispatcher's return.
import { u16 } from "../../../core/int.js";
import { armObjectAnimAndRequestSound } from "./armObjectAnimAndRequestSound.js";
import { tickDeactivatedObjectAnim } from "./tickDeactivatedObjectAnim.js";
import { endObjectAnimOnTimerExpiry } from "./endObjectAnimOnTimerExpiry.js";
import { noopAnimDispatchSlot } from "./noopAnimDispatchSlot.js";

// Object-record field offset: the animation sub-state index (0..3) that selects the handler.
const SUBSTATE = 2;

export function loc_10e4(m, record = m.regs.ix) {
  switch (m.mem8[u16(record + SUBSTATE)]) {
    case 0:
      return armObjectAnimAndRequestSound(m, record);
    case 1:
      return tickDeactivatedObjectAnim(m, record);
    case 2:
      return endObjectAnimOnTimerExpiry(m, record);
    case 3:
      return noopAnimDispatchSlot(m, record);
  }
}
