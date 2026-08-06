// SPDX-License-Identifier: GPL-3.0-only
/** postChainedHitScore — post the next entry of an eight-long climbing chain, one entry per call, and
 * re-arm the window that keeps the chain alive. A call arriving while the window cell still
 * holds a count advances the step cell and posts a value that climbs with it, wrapping back to
 * the first entry after the eighth; a call arriving once the window has run down to zero posts
 * the first entry and leaves the step cell alone. Both paths re-arm the window, so closely
 * spaced calls climb and an isolated call starts over. LIVE-OUT: memory-only. */

import { postCommand } from "./postCommand.js";
import { u8 } from "../../../core/int.js";

const CHAIN_WINDOW = 0xa99d;
const CHAIN_STEP = 0xa99e;
const CHAIN_COMMAND = 4;
const CHAIN_LENGTH = 8;
const WINDOW_RELOAD = 30;

export function postChainedHitScore(m) {
  const { mem8 } = m;
  if (mem8[CHAIN_WINDOW] === 0) {
    postCommand(m, CHAIN_COMMAND, 1);
  } else {
    const step = u8(mem8[CHAIN_STEP] + 1);
    mem8[CHAIN_STEP] = step;
    postCommand(m, CHAIN_COMMAND, (step % CHAIN_LENGTH) + 1);
  }
  mem8[CHAIN_WINDOW] = WINDOW_RELOAD;
}
