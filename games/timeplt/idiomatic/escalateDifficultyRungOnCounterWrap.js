// SPDX-License-Identifier: GPL-3.0-only
/** escalateDifficultyRungOnCounterWrap — advance a three-place base-sixty tick counter; only on a full roll-over count down a
 * reload timer, and each time that timer fires rearm it, climb the escalation rung one step toward
 * its ceiling, and apply the row that rung selects. LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { advanceSexagesimalDigit } from "./advanceSexagesimalDigit.js";
import { applyEraRungSettings } from "./applyEraRungSettings.js";

const COUNTER = 0xad05;
const RELOAD_TIMER = 0xa9d7;
const RELOAD_VALUE = 0xa9d6;
const ESCALATION_RUNG = 0xacc0;
const TOP_RUNG = 0x0f;

export function escalateDifficultyRungOnCounterWrap(m) {
  const { mem8 } = m;

  // carry into the next place only while a place rolls over; a place that holds ends the whole pass
  if (!advanceSexagesimalDigit(m, COUNTER)) return;
  if (advanceSexagesimalDigit(m, COUNTER + 1)) advanceSexagesimalDigit(m, COUNTER + 2);

  if (mem8[RELOAD_TIMER] === 0) return;
  mem8[RELOAD_TIMER] = u8(mem8[RELOAD_TIMER] - 1);
  if (mem8[RELOAD_TIMER] !== 0) return;

  mem8[RELOAD_TIMER] = mem8[RELOAD_VALUE];
  const rung = u8(mem8[ESCALATION_RUNG] + 1);
  mem8[ESCALATION_RUNG] = rung > TOP_RUNG ? TOP_RUNG : rung;

  return applyEraRungSettings(m);
}
