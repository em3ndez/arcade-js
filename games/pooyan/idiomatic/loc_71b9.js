// SPDX-License-Identifier: GPL-3.0-only
import { loc_71c7 } from "./loc_71c7.js";
import { loc_72a0 } from "./loc_72a0.js";
import { loc_7421 } from "./loc_7421.js";
import { loc_02ef } from "./loc_02ef.js";
import { WAVE_OUTER_PHASE } from "./names.js";
/**
 * loc_71b9 — bonus/eagle-stage phase dispatcher. Selects a phase handler by the outer wave phase, then
 * runs the shared epilogue the handler returned into (which returns to our caller). LIVE-OUT: memory only.
 */
export function loc_71b9(m) {
  switch (m.mem8[WAVE_OUTER_PHASE]) {
    case 0: loc_71c7(m); break;
    case 1: loc_72a0(m); break;
    case 2: loc_7421(m); break;
    default:
      throw new Error("loc_71b9: bonus/eagle phase > 2 (guard-slack; the table has 3 entries)");
  }
  return loc_02ef(m); // shared epilogue the handler returned into
}
