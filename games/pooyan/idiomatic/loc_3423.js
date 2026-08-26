// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { loc_34f2 } from "./loc_34f2.js";
import { loc_343e } from "./loc_343e.js";
import { loc_3473 } from "./loc_3473.js";
import { ANIM_ARMED_LATCH } from "./names.js";
/**
 * loc_3423 — enemy-actor state-1 entry prologue for the record based at IX. Steps the record's
 * animation frame, then branches on bit0 of the mode byte (rec+0x01): clear dispatches on the state
 * byte (rec+0x08) — nonzero into the Y-movement handler, zero into the X-movement body; set gates on
 * the anim-armed latch — nonzero returns, otherwise it clears the mode byte and defers to the shared
 * interior tail.
 *
 * LIVE-OUT: none — memory only; the record-dispatch caller reloads A and reads no register back.
 */
const OFF_MODE = 0x01; //  bit0 selects the dispatch arm
const OFF_STATE = 0x08; // nonzero -> Y-movement handler, zero -> X-movement body

export function loc_3423(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec); // step the record's animation frame

  if ((mem8[u16(rec + OFF_MODE)] & 0x01) === 0) {
    if (mem8[u16(rec + OFF_STATE)] !== 0) return loc_34f2(m, rec);
    return loc_343e(m, rec); // delegate the state-1 X-movement body
  }

  if (mem8[ANIM_ARMED_LATCH] !== 0) return; // latch still armed -> idle
  mem8[u16(rec + OFF_MODE)] = 0x00;
  return loc_3473(m, rec);
}
