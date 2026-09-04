// SPDX-License-Identifier: GPL-3.0-only
import { waitFrames } from "./waitFrames.js";

/**
 * waitLongDelay — pause the attract sequence for 0x80 frames.
 *
 * WHAT IT IS
 *   A fixed 0x80 (128) frame delay used to pace the attract screens. It is the longer of the attract
 *   waits, built directly on the primitive frame-delay busy-wait.
 *
 * ROLE IN THE MACHINE
 *   The attract sequence runs off the interrupt heartbeat: waitFrames seats the frame counter
 *   FRAME_DELAY_TIMER (0x20c0) and yields until the vblank handler (0x0010) drains it to zero. This
 *   wrapper just fixes the count at 0x80. Being a generator, each yield inside is one displayed frame,
 *   so the caller's own `yield*` keeps the demo advancing while it waits.
 *
 * ROM 0x0ab6-...  Grounding: [seen].
 *
 * LIVE-OUT: memory only.
 */
export function* waitLongDelay(m) {
  // Delegate to the frame-delay primitive with the fixed 0x80-frame count, forwarding its per-frame yields.
  yield* waitFrames(m, 0x80);
}
