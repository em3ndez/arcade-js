// SPDX-License-Identifier: GPL-3.0-only
import { INTRO_PHASE_INDEX } from "./names.js";
import { seatIntroLaunchScriptAndAdvancePhase } from "./seatIntroLaunchScriptAndAdvancePhase.js";
import { runLevelIntroPhase1Frame } from "./runLevelIntroPhase1Frame.js";
import { loc_6f42 } from "./loc_6f42.js";
import { advanceLevelIntroFromPhase3 } from "./advanceLevelIntroFromPhase3.js";
import { loc_6f9d } from "./loc_6f9d.js";
import { loc_7032 } from "./loc_7032.js";
import { loc_705f } from "./loc_705f.js";

/**
 * dispatchLevelIntroPhase — level-intro / round-start phase dispatcher (top-level game state 2).
 * Runs the handler for the current intro phase; the handler returns straight to this dispatcher's
 * caller (a tail dispatch). Seven phases.
 *
 * LIVE-OUT: none — a void per-frame dispatch.
 */
export function dispatchLevelIntroPhase(m) {
  switch (m.mem8[INTRO_PHASE_INDEX]) {
    case 0: return seatIntroLaunchScriptAndAdvancePhase(m);
    case 1: return runLevelIntroPhase1Frame(m);
    case 2: return loc_6f42(m);
    case 3: return advanceLevelIntroFromPhase3(m);
    case 4: return loc_6f9d(m);
    case 5: return loc_7032(m);
    case 6: return loc_705f(m);
  }
}
