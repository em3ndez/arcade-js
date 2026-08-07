// SPDX-License-Identifier: GPL-3.0-only
/** steerTowardAimAtFixedRate — turn one object a step nearer the heading it is aiming at. It does nothing on one
 * frame in four. Both the standing test and the direction test are taken on the gap PLUS ONE
 * rather than on the gap, so it turns the shorter way round everywhere except at a gap of exactly
 * one short of a half turn, where the offset tips it to the longer side. The offset also leaves
 * the standing band two gaps wide and off centre — the aim reached exactly, and the aim one step
 * behind it — which is what stops it hunting. Because the heading moves in TWOS across a band of
 * two, which of the two it comes to rest on follows the parity of the gap and not the side it came
 * from: an even gap ends with the heading on the aim, an odd one with the aim one step behind, for
 * good. LIVE-OUT: memory only — the one heading byte. */

import { u8 } from "../../../core/int.js";
import { FRAME_TICK } from "./names.js";

const IDLE_PHASE = 3;

const AIM_HEADING = 1;
const CURRENT_HEADING = 2;

const TEST_OFFSET = 1;
const STANDING_BAND = 2;
const HALF_TURN = 0x80;
const STEP = 2;

export function steerTowardAimAtFixedRate(m) {
  const { regs, mem8 } = m;
  const object = regs.ix;

  if ((mem8[FRAME_TICK] & IDLE_PHASE) === 0) return;

  const current = mem8[object + CURRENT_HEADING];
  const decidedOn = u8(mem8[object + AIM_HEADING] - current + TEST_OFFSET);
  if (decidedOn < STANDING_BAND) return;

  mem8[object + CURRENT_HEADING] = decidedOn < HALF_TURN ? current + STEP : current - STEP;
}
