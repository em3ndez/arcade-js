// SPDX-License-Identifier: GPL-3.0-only
/**
 * animateIntroClimbStep — step 2 of the opening Kong-climb cutscene: animate the climb each frame
 * and, once the climber reaches the top, hand the cutscene to its next phase.
 *
 * The opening Kong-climb cutscene — the short intro that plays at the head of every board — walks
 * INTRO_STEP from 0 to 7, one handler per step, dispatched every frame. This is the handler for
 * step 2, the phase that plays the actual climb. Where the step before it is a one-shot that stages
 * the climb pose, this step RUNS the climb: it is re-dispatched every frame while INTRO_STEP is 2
 * and, per frame:
 *
 *   - Advance the ten-record sprite-object block one animation frame (which scrolls the climbing
 *     figures up 4px on every eighth call) and bump the cutscene's private tick counter. This
 *     happens unconditionally.
 *   - Every 16th tick — the low nibble of that counter at 0 — slide the climb-graphic strip up one
 *     tilemap row: the periodic background scroll.
 *   - Read the climbing figure's Y, which is record 0's Y byte in the sprite-object block and walks
 *     UPWARD (smaller) as the sprite scrolls. While it is still at or above the top-out row the
 *     climb has not finished, so return and repeat next frame.
 *
 * When that Y finally drops past the top-out row the climb has reached the top. Advance the
 * cutscene:
 *   - arm SUBSTATE_TIMER to 32 frames — a metered pause for the next phase;
 *   - increment INTRO_STEP 2 -> 3, so the next frame dispatches the following step;
 *   - point SEQ_ADVANCE_PTR at INTRO_STEP, so the shared gated tick advances it again once that
 *     timer expires.
 *
 * Both callees read and write only through the machine and need no register setup. Every store this
 * routine makes of its own is work RAM; the callees also touch video RAM, and no hardware latch is
 * written from here.
 *
 * LIVE-OUT: memory-only. The dispatcher discards this handler's return and reads no register or
 * flag it leaves behind.
 */

import { animateSpriteObjectBlock } from "./animateSpriteObjectBlock.js";
import { scrollClimbGraphicStep } from "./scrollClimbGraphicStep.js";
import { SUBSTATE_TIMER, INTRO_STEP, SEQ_ADVANCE_PTR, SPRITE_OBJ_BLOCK } from "./names.js";

const TICK_COUNTER = 0x62af; // the cutscene's private 1-in-16 tick counter; it has no shared name
const CLIMBER_Y = SPRITE_OBJ_BLOCK + 3; // record 0's Y byte — the climbing figure

export function animateIntroClimbStep(m) {
  const { mem } = m;

  // Advance the climb animation and bump the tick counter.
  animateSpriteObjectBlock(m);

  // Every 16th tick, scroll the climb graphic up one tilemap row.
  if ((mem.read8(TICK_COUNTER) & 0x0f) === 0) {
    scrollClimbGraphicStep(m);
  }

  // While the climbing figure is still below the top-out row, stay in this step and repeat next
  // frame.
  if (mem.read8(CLIMBER_Y) >= 0x5d) return;

  // The climb topped out — advance the cutscene to its next phase.
  mem.write8(SUBSTATE_TIMER, 0x20);                           // arm the 32-frame pause
  mem.write8(INTRO_STEP, (mem.read8(INTRO_STEP) + 1) & 0xff); // step 2 -> 3
  mem.write16(SEQ_ADVANCE_PTR, INTRO_STEP);                   // let the gated tick advance it next
}
