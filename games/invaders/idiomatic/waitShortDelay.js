// SPDX-License-Identifier: GPL-3.0-only
import { waitFrames } from "./waitFrames.js";

/**
 * waitShortDelay — the attract sequence's short paced delay.
 *
 * WHAT IT IS
 *   Waits 0x40 (64) frames by handing that count to waitFrames, which seeds the frame counter
 *   FRAME_DELAY_TIMER (0x20c0) and yields until the vblank interrupt drains it to zero.
 *
 * ROLE IN THE MACHINE
 *   One of the fixed-length pacing delays the attract spine uses to hold a screen between typed blocks
 *   and reveals (runAttractCycle calls it repeatedly; its sibling waitLongDelay uses a larger count).
 *   Because FRAME_DELAY_TIMER is decremented once per frame by the vblank ISR, each yielded frame here
 *   is one displayed frame — this is how the clock-free engine paces animation without a real timer.
 *
 * ROM 0x0ab1.  Grounding: [seen].
 *
 * LIVE-OUT: memory only (FRAME_DELAY_TIMER drained to 0). Generator; memory-only.
 */
export function* waitShortDelay(m) {
  // Delay 0x40 frames via the shared frame-counter busy-wait.
  yield* waitFrames(m, 0x40);
}
