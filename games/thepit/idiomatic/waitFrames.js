// SPDX-License-Identifier: GPL-3.0-only
/**
 * waitFrames — pause for a fixed number of video frames, then return.  ROM 0x4bff.
 *
 * Several boot and round-transition steps need to hold for a set number of frames
 * — to leave a title on screen, let a fanfare finish, or space out a multi-step
 * setup. This is that pause. It stows the caller's frame count in the per-frame
 * countdown cell, switches the per-frame interrupt on (its service routine ticks
 * that countdown down by one every frame), then sits in a tight loop until the
 * countdown reaches zero and returns. Every pass through the loop kicks the
 * watchdog, so a long wait never looks like a lockup and trips a reset. A count of
 * zero falls straight through — no wait — but still makes one pass, so the watchdog
 * is kicked even then.
 *
 * The number of frames to hold is passed in by the caller as `count`. The routine
 * still returns the way its callers expect — popping back through the work stack —
 * so a caller pushes the address it wants to resume at before calling and the wait
 * unwinds straight there (a tail-caller lets its own return address serve).
 * Nothing here decrements the countdown: in the live game the per-frame interrupt
 * does, so this loop's termination is driven by memory it never writes itself. Run
 * in isolation there is no interrupt, so the test models that once-per-frame tick
 * identically on both sides to let the wait terminate.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4bff.test.js.
 * GATE:     crafted-harness — the once-per-frame countdown tick (the interrupt's
 *           job in the live game) is modelled by one identical hook on both sides so
 *           the busy-wait terminates. EQUAL over a frame-count sweep {0,1,2,60,255}
 *           on the real boot dispatch state; count 0 is also proven with no hook
 *           (natural fall-through). Reached from boot (coldBootInit) onward.
 * LIVE-OUT: memory-only — the countdown cell FRAME_WAIT_COUNTDOWN (0x8009) left at 0,
 *           plus the return to the caller (pc/SP). The working registers and flags the loop leaves
 *           behind are dead — no caller reads them back.
 * NAMES:    FRAME_WAIT_COUNTDOWN (0x8009), the per-frame countdown cell, from names.js.
 *           0xb000 (interrupt-enable latch) and 0xb800 (watchdog kick) are I/O
 *           addresses, not work RAM.
 */

import { FRAME_WAIT_COUNTDOWN } from "./names.js";
export function* waitFrames(m, count) {
  const { mem8 } = m;

  // Arm the countdown with the caller's frame count, then enable the per-frame
  // interrupt whose service routine decrements that countdown once per frame.
  mem8[FRAME_WAIT_COUNTDOWN] = count;
  mem8[0xb000] = 1;

  // Spin until the countdown has been ticked all the way down to zero, kicking the
  // watchdog on every pass. `yield` is the vblank wait: the coroutine engine fires the
  // per-frame NMI there, which ticks the countdown down by one, then resumes here.
  let remaining;
  do {
    mem8[0xb800]; // kick the watchdog
    yield;        // wait one vblank (the NMI decrements FRAME_WAIT_COUNTDOWN)
    remaining = mem8[FRAME_WAIT_COUNTDOWN]; // reload the countdown the NMI is decrementing
  } while (remaining !== 0);

  return m.ret();
}
