// SPDX-License-Identifier: GPL-3.0-only
import { loc_0dab } from "./loc_0dab.js";
/**
 * loc_0da8 — thin entry that seats HL = the start-of-life state seed (256) and falls through to the
 * start-of-life setup. The seed is placed both on the register bridge and as the setup's explicit
 * first argument, so it survives whether the dissolved callee reads the argument or the bridge.
 *
 * LIVE-OUT: whatever the start-of-life setup leaves (memory only).
 */
export function loc_0da8(m) {
  return (m.regs.hl = 256), loc_0dab(m, 256); // the start-of-life state seed
}
