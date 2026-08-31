// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceObjectColumnByStepAndDispatch } from "./advanceObjectColumnByStepAndDispatch.js";
import { advanceActorColumnAndArmTurnOrBand } from "./advanceActorColumnAndArmTurnOrBand.js";
import { armInteriorBandOrMarkActorActive } from "./armInteriorBandOrMarkActorActive.js";
import { ANIM_ARMED_LATCH } from "./names.js";
/**
 * dispatchActorState1MovementByMode — enemy-actor state-1 entry prologue for the record based at IX. Steps the record's
 * animation frame, then branches on bit0 of the mode byte (rec+0x01): clear dispatches on the state
 * byte (rec+0x08) — nonzero into the Y-movement handler, zero into the X-movement body; set gates on
 * the anim-armed latch — nonzero returns, otherwise it clears the mode byte and defers to the shared
 * interior tail.
 *
 * LIVE-OUT: none — memory only; the record-dispatch caller reloads A and reads no register back.
 */
const OFF_MODE = 0x01; //  bit0 selects the dispatch arm
const OFF_STATE = 0x08; // nonzero -> Y-movement handler, zero -> X-movement body

export function dispatchActorState1MovementByMode(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec); // step the record's animation frame

  if ((mem8[u16(rec + OFF_MODE)] & 0x01) === 0) {
    if (mem8[u16(rec + OFF_STATE)] !== 0) return advanceObjectColumnByStepAndDispatch(m, rec);
    return advanceActorColumnAndArmTurnOrBand(m, rec); // delegate the state-1 X-movement body
  }

  if (mem8[ANIM_ARMED_LATCH] !== 0) return; // latch still armed -> idle
  mem8[u16(rec + OFF_MODE)] = 0x00;
  return armInteriorBandOrMarkActorActive(m, rec);
}
