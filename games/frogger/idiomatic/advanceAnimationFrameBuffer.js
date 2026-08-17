// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceAnimationFrameBuffer — step the frame-cell animation: gate on two busy latches and a countdown timer, then
 * copy the next indexed frame into the animation buffer.
 * LIVE-OUT: memory-only.
 */
import { SPRITE_FRAME_BUSY_LATCH1, SPRITE_FRAME_BUSY_LATCH2, ANIM_FRAME_INDEX, ANIM_FRAME_TIMER, ANIM_FRAME_SRC_PTR_TABLE, ANIM_FRAME_BUFFER } from "./names.js";

const TIMER_RELOAD = 21;
const TABLE_LEN = 10;
const FRAME_BYTES = 11;

export function advanceAnimationFrameBuffer(m) {
  const { mem8, mem16 } = m;

  if (mem8[SPRITE_FRAME_BUSY_LATCH1] !== 0) return;
  if (mem8[SPRITE_FRAME_BUSY_LATCH2] !== 0) return;

  if (mem8[ANIM_FRAME_TIMER] !== 0) {
    mem8[ANIM_FRAME_TIMER] = mem8[ANIM_FRAME_TIMER] - 1; // timer still running -> just tick it down
    return;
  }

  const index = mem8[ANIM_FRAME_INDEX];
  const src = mem16[(ANIM_FRAME_SRC_PTR_TABLE + 2 * index)];
  const nextIndex = (index + 1) & 0xff;
  mem8[ANIM_FRAME_TIMER] = TIMER_RELOAD;

  if (nextIndex === TABLE_LEN) {
    mem8[ANIM_FRAME_INDEX] = 0; // index wrapped back to the table start; no frame copied this pass
    return;
  }
  mem8[ANIM_FRAME_INDEX] = nextIndex;

  for (let i = 0; i < FRAME_BYTES; i++) {
    mem8[(ANIM_FRAME_BUFFER + i)] = mem8[(src + i)];
  }
}
