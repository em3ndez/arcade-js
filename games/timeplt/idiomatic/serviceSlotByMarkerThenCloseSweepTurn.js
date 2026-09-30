// SPDX-License-Identifier: GPL-3.0-only
/** serviceSlotByMarkerThenCloseSweepTurn — one turn of the per-slot sweep over an object bank: pick the slot's handler from its
 * marker byte and let that handler close the turn. A free slot (marker zero) is passed over; any
 * marker other than full is a drifting countdown object, stepped and then passed; a full marker is
 * a chased object whose handler turns on the era and on the record's countdown — the final era runs
 * the approach-then-breakaway handler, a live countdown flies the slot and ticks it, and a spent one
 * chases its aim point for the frame. Every path ends in closing the turn, which goes round again
 * while turns remain. The record cursor, the sprite-entry cursor and the turns left are this turn's
 * arguments and are handed on as arguments. LIVE-OUT: memory. */

import { u16 } from "../../../core/int.js";
import { ERA_INDEX } from "./names.js";
import { closeOneTurnOfTheSlotSweep } from "./closeOneTurnOfTheSlotSweep.js";
import { stepDriftingCountdownObjectByEraFrames } from "./stepDriftingCountdownObjectByEraFrames.js";
import { stepSlotApproachThenBreakawayRetire } from "./stepSlotApproachThenBreakawayRetire.js";
import { flyAndRetireSlotCyclingShapeInEra4 } from "./flyAndRetireSlotCyclingShapeInEra4.js";
import { chaseOneAimPointAndRetireAtTheLine } from "./chaseOneAimPointAndRetireAtTheLine.js";

const MARKER = 0x00;
const COUNTDOWN = 0x0e;
const FREE = 0x00;
const FULL = 0xff;
const FINAL_ERA = 4;

export function serviceSlotByMarkerThenCloseSweepTurn(m, ix = m.regs.ix, iy = m.regs.iy, b = m.regs.b) {
  const { mem8 } = m;
  const marker = mem8[u16(ix + MARKER)];

  if (marker === FREE) return closeOneTurnOfTheSlotSweep(m, ix, iy, b);

  if (marker !== FULL) {
    stepDriftingCountdownObjectByEraFrames(m, ix, iy);
    return closeOneTurnOfTheSlotSweep(m, ix, iy, b);
  }

  if (mem8[ERA_INDEX] === FINAL_ERA) return stepSlotApproachThenBreakawayRetire(m, ix, iy, b);

  const countdown = u16(ix + COUNTDOWN);
  if (mem8[countdown] !== 0) {
    // a live countdown: fly the slot, tick its countdown, then close the turn
    flyAndRetireSlotCyclingShapeInEra4(m, ix, iy);
    mem8[countdown] = mem8[countdown] - 1;
    return closeOneTurnOfTheSlotSweep(m, ix, iy, b);
  }

  chaseOneAimPointAndRetireAtTheLine(m, ix, iy);
  return closeOneTurnOfTheSlotSweep(m, ix, iy, b);
}
