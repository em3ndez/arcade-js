// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceAnimationFrameBuffer — step the frame-cell animation: gate on two busy latches and a countdown timer, then
 * copy the next indexed frame into the animation buffer.
 * LIVE-OUT: memory-only.
 */
import { loc_814f, loc_815b, loc_81b3, loc_81b4, loc_1841, loc_819b } from "./names.js";

const TIMER_RELOAD = 21;
const TABLE_LEN = 10;
const FRAME_BYTES = 11;

export function advanceAnimationFrameBuffer(m) {
  const { mem8, mem16 } = m;

  if (mem8[loc_814f] !== 0) return;
  if (mem8[loc_815b] !== 0) return;

  if (mem8[loc_81b4] !== 0) {
    mem8[loc_81b4] = mem8[loc_81b4] - 1; // timer still running -> just tick it down
    return;
  }

  const index = mem8[loc_81b3];
  const src = mem16[(loc_1841 + 2 * index) & 0xffff];
  const nextIndex = (index + 1) & 0xff;
  mem8[loc_81b4] = TIMER_RELOAD;

  if (nextIndex === TABLE_LEN) {
    mem8[loc_81b3] = 0; // index wrapped back to the table start; no frame copied this pass
    return;
  }
  mem8[loc_81b3] = nextIndex;

  for (let i = 0; i < FRAME_BYTES; i++) {
    mem8[(loc_819b + i) & 0xffff] = mem8[(src + i) & 0xffff];
  }
}
