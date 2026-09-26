// SPDX-License-Identifier: GPL-3.0-only
/** serviceSlotByMarkerThenCloseSweepTurn — one turn of the per-slot sweep over an object bank: pick the slot's handler from its
 * marker byte and let that handler close the turn. A free slot (marker zero) is passed over; any
 * marker other than full is a drifting countdown object, stepped and then passed; a full marker is
 * a chased object whose handler turns on the era and on the record's countdown — the final era runs
 * the approach-then-breakaway handler, a live countdown flies the slot and ticks it, and a spent one
 * chases its aim point for the frame. Every path ends in closing the turn, which goes round again
 * while turns remain. LIVE-OUT: memory, the two cursors and the turn count. */

import { u16 } from "../../../core/int.js";
import { ERA_INDEX } from "./names.js";
import { closeOneTurnOfTheSlotSweep } from "./closeOneTurnOfTheSlotSweep.js";
import { stepDriftingCountdownObjectByEraFrames } from "./stepDriftingCountdownObjectByEraFrames.js";
import { stepSlotApproachThenBreakawayRetire } from "./stepSlotApproachThenBreakawayRetire.js";
import { flyLiveSlotAndTickCountdown } from "./flyLiveSlotAndTickCountdown.js";
import { chaseOneAimPointAndRetireAtTheLine } from "./chaseOneAimPointAndRetireAtTheLine.js";

const MARKER = 0x00;
const COUNTDOWN = 0x0e;
const FREE = 0x00;
const FULL = 0xff;
const FINAL_ERA = 4;

export function serviceSlotByMarkerThenCloseSweepTurn(m, ix = m.regs.ix) {
  const { mem8 } = m;
  const marker = mem8[u16(ix + MARKER)];

  if (marker === FREE) return closeOneTurnOfTheSlotSweep(m);

  if (marker !== FULL) {
    stepDriftingCountdownObjectByEraFrames(m);
    return closeOneTurnOfTheSlotSweep(m);
  }

  if (mem8[ERA_INDEX] === FINAL_ERA) return stepSlotApproachThenBreakawayRetire(m);
  if (mem8[u16(ix + COUNTDOWN)] !== 0) return flyLiveSlotAndTickCountdown(m);

  chaseOneAimPointAndRetireAtTheLine(m);
  return closeOneTurnOfTheSlotSweep(m);
}
