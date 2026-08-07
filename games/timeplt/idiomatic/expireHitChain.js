// SPDX-License-Identifier: GPL-3.0-only
/** expireHitChain — count one window down by one a frame and, once it has already run out, hold the
 * byte next to it at zero. The two are not done together: while the window still has anything in
 * it the neighbour is left alone, and once the window reads zero it stops being counted and the
 * neighbour is cleared instead — every frame, not once. LIVE-OUT: memory. */

import { CHAIN_WINDOW, CHAIN_STEP } from "./names.js";

export function expireHitChain(m) {
  const { mem8 } = m;
  const remaining = mem8[CHAIN_WINDOW];
  if (remaining === 0) {
    mem8[CHAIN_STEP] = 0;
    return;
  }
  mem8[CHAIN_WINDOW] = remaining - 1;
}
