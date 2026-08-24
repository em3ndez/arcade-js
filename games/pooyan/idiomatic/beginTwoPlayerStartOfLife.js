// SPDX-License-Identifier: GPL-3.0-only
import { startNewGamePlay } from "./startNewGamePlay.js";
/**
 * beginTwoPlayerStartOfLife — thin entry that seats HL = the start-of-life state seed (256) and falls through to the
 * start-of-life setup. The seed is placed both on the register bridge and as the setup's explicit
 * first argument, so it survives whether the dissolved callee reads the argument or the bridge.
 *
 * LIVE-OUT: whatever the start-of-life setup leaves (memory only).
 */
export function beginTwoPlayerStartOfLife(m) {
  return (m.regs.hl = 256), startNewGamePlay(m, 256); // the start-of-life state seed
}
