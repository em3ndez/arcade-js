// SPDX-License-Identifier: GPL-3.0-only
import { loc_3d57 } from "./loc_3d57.js";

/**
 * loc_3fd6 -- a tail-jump trampoline into the service-loop head (the input-test screen). Its own body writes
 * nothing; it just transfers control. Only reached with the service switch held, and the input-screen wrapper
 * folds its per-frame loop internally, so nothing idiomatic enters here. [code]
 */
export function loc_3fd6(m) {
  return loc_3d57(m); // tail-jump to the spine head (never returns)
}
