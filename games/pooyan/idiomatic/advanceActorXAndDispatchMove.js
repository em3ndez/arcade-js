// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_362d } from "./loc_362d.js";
import { finishActorOrArmTurnaround } from "./finishActorOrArmTurnaround.js";
import { STAGE_COUNTDOWN } from "./names.js";
/**
 * advanceActorXAndDispatchMove — advance an actor's X, then dispatch on the stage countdown.
 *
 * Adds the record's signed step (rec+0x0a) to its X (rec+0x05); when X is below the negated step
 * the lap counter (rec+0x06) is decremented first. Late in the stage (countdown below 3) the
 * record is handed to the phase-state dispatch with the new X carried in B; otherwise it tails
 * into the end-of-move dispatch.
 *
 * LIVE-OUT: none — a dispatched state handler; the caller reloads A and reads no register back.
 */
const REC_X = 0x05;
const REC_LAP_COUNTER = 0x06;
const REC_STEP = 0x0a;
const AI_GATE = 0x03; // stage-countdown value below which AI hands off to the phase dispatch

export function advanceActorXAndDispatchMove(m, rec = m.regs.ix) {
  const { mem8 } = m;
  const step = mem8[rec + REC_STEP];
  const x = mem8[rec + REC_X];
  if (x < u8(-step)) mem8[rec + REC_LAP_COUNTER] = mem8[rec + REC_LAP_COUNTER] - 1;
  const newX = u8(x + step);
  mem8[rec + REC_X] = newX;
  if (mem8[STAGE_COUNTDOWN] < AI_GATE) return loc_362d(m, rec, newX); // new X in B
  return finishActorOrArmTurnaround(m, rec);
}
