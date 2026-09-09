// SPDX-License-Identifier: GPL-3.0-only
import { loc_3d57 } from "./loc_3d57.js";

/**
 * loc_3fd6 (ROM 0x3fd6) -- a tail-jump trampoline into the service-loop head (the operator input-test
 * screen). Its own body writes nothing; it just transfers control, the ROM's way of reaching the same
 * never-returning loop from a second call site. It is only reached with the service switch held, and the
 * input-screen wrapper (loc_3d57) folds its per-frame loop internally, so in the idiomatic layer nothing
 * actually enters here during play -- it exists to mirror the oracle's control flow exactly. [code]
 */
export function loc_3fd6(m) {
  // Transfer straight into the input-test spine head; that loop never returns, so neither does this.
  return loc_3d57(m); // tail-jump to the spine head (never returns)
}
