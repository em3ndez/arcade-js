// SPDX-License-Identifier: GPL-3.0-only
import { loc_0fef } from "./loc_0fef.js";
import { loc_1016 } from "./loc_1016.js";
import { loc_1090 } from "./loc_1090.js";
import { loc_10a2 } from "./loc_10a2.js";
import { loc_113c } from "./loc_113c.js";
import { loc_114f } from "./loc_114f.js";
import { loc_1035 } from "./loc_1035.js";
import { MAINLOOP_SUBSTATE_SELECTOR } from "./names.js";

/**
 * loc_0fd5 — the main-loop sub-state dispatcher. Routes on (MAINLOOP_SUBSTATE_SELECTOR & 7) to one of
 * six handlers. States 0 and 1 hand off to their handler and return through it; states 2..5 run the
 * selected handler and then the shared post-handler tail (the four trailing per-frame passes) before
 * returning. Selectors 6 and 7 fall past the six-entry table and throw (guard-slack).
 *
 * LIVE-OUT: memory only — the selected handler's effects (and the tail's, for states 2..5). No
 * register input (no handler reads a register on entry) and no register output.
 */
export function loc_0fd5(m) {
  switch (m.mem8[MAINLOOP_SUBSTATE_SELECTOR] & 7) {
    case 0: return loc_0fef(m);
    case 1: return loc_1016(m);
    case 2: loc_1090(m); return loc_1035(m);
    case 3: loc_10a2(m); return loc_1035(m);
    case 4: loc_113c(m); return loc_1035(m);
    case 5: loc_114f(m); return loc_1035(m);
    default:
      throw new Error("loc_0fd5: main-loop sub-state selector > 5 (guard-slack)");
  }
}
