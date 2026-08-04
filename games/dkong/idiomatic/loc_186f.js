// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_186f — one timer-gated step of the board-advance animation: hold a pose, then swap in
 * the next frame, pulse a sound and move the sequence on.
 *
 * A step handler in the board-cleared interlude that plays between boards, on the even
 * boards. The interlude runs as a numbered sequence and a step selector says which step this
 * frame belongs to; this handler owns one of them. Every step in the family has the same
 * shape — hold a pose for a run of frames, then on expiry swap in the next animation frame
 * and move the sequence on — and this is the leanest of them: it re-arms nothing, so
 * advancing the step selector is the only thing carrying the sequence forward.
 *
 * On each frame:
 *   - Tick the interlude's frame timer, SUBSTATE_TIMER. While it counts down that is all
 *     that happens and the pose is held. On the single expiry frame:
 *   - Copy this step's ten-record sprite-object frame — forty bytes, four per record — over
 *     SPRITE_OBJ_BLOCK, which is what puts the next pose on screen.
 *   - Assert one of the sound latches for three frames, the standard pulse the sound service
 *     counts back down over the following vblanks.
 *   - Advance the step selector, so the next frame dispatches the following step.
 *
 * Nothing downstream reads a value back from this handler.
 *
 * NOT CLAIMED: what the animation depicts. The mechanics are what is established here.
 *
 * LIVE-OUT: memory-only, and every write lands in work RAM — the interlude timer, the
 * sprite-object block, the sound latch and the step selector. No hardware latch is touched,
 * so there is no bus-positioned write to preserve.
 */

import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { SUBSTATE_TIMER, SND_TRIGGER, BOARD_ADVANCE_STEP } from "./names.js";

const COPY_SOURCE = 0x3a1f; // this step's ten-record sprite-object frame
const SND_LATCH = SND_TRIGGER + 4; // the sound latch this step pulses
const SND_ASSERT_FRAMES = 0x03; // frames it stays asserted; the sound service counts it down

export function loc_186f(m) {
  const { regs, mem } = m;

  // Hold this pose until the frame timer expires. While it counts down, tick it and
  // abort back to the dispatcher.
  if (!tickSubstateTimer(m)) return;

  // Timer expired — swap in this step's sprite-object frame: copy the forty-byte
  // ten-record template over SPRITE_OBJ_BLOCK. The copy reads its source from the
  // register image.
  regs.hl = COPY_SOURCE;
  loadSpriteObjectBlock(m);

  // Pulse the 3-frame sound-latch assert, then advance the render-sequence step selector.
  mem.write8(SND_LATCH, SND_ASSERT_FRAMES);
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);
}
