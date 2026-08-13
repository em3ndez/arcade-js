// SPDX-License-Identifier: GPL-3.0-only
/** escalateDifficultyRungOnCounterWrap — advance a three-place base-sixty tick counter; only on a full roll-over count down a
 * reload timer, and each time that timer fires rearm it, climb the escalation rung one step toward
 * its ceiling, and apply the row that rung selects. LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { advanceSexagesimalDigit } from "./advanceSexagesimalDigit.js";
import { applyEraRungSettings } from "./applyEraRungSettings.js";
import { ERA_RUNG, ERA_RUNG_PERIOD, ERA_RUNG_TIMER, LIFE_TICKS_LOW } from "./names.js";

const TOP_RUNG = 0x0f;

export function escalateDifficultyRungOnCounterWrap(m) {
  const { mem8 } = m;

  // carry into the next place only while a place rolls over; a place that holds ends the whole pass
  if (!advanceSexagesimalDigit(m, LIFE_TICKS_LOW)) return;
  if (advanceSexagesimalDigit(m, LIFE_TICKS_LOW + 1)) advanceSexagesimalDigit(m, LIFE_TICKS_LOW + 2);

  if (mem8[ERA_RUNG_TIMER] === 0) return;
  mem8[ERA_RUNG_TIMER] = u8(mem8[ERA_RUNG_TIMER] - 1);
  if (mem8[ERA_RUNG_TIMER] !== 0) return;

  mem8[ERA_RUNG_TIMER] = mem8[ERA_RUNG_PERIOD];
  const rung = u8(mem8[ERA_RUNG] + 1);
  mem8[ERA_RUNG] = rung > TOP_RUNG ? TOP_RUNG : rung;

  return applyEraRungSettings(m);
}
