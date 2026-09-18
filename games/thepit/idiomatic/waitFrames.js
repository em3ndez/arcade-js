// SPDX-License-Identifier: GPL-3.0-only
/**
 * waitFrames — pause for a fixed number of video frames, then return.
 *
 * Several boot and round-transition steps hold for a set number of frames — to leave a title
 * on screen, let a fanfare finish, or space out a multi-step setup. It stows the caller's frame
 * count in FRAME_WAIT_COUNTDOWN, enables the per-frame interrupt (whose service routine ticks
 * that countdown down once per frame), then spins until it reaches zero. Every pass kicks the
 * watchdog so a long wait never trips a reset; a count of zero still makes one pass and kicks it.
 */

import { FRAME_WAIT_COUNTDOWN, NMI_MASK_LATCH, WATCHDOG_KICK } from "./names.js";
export function* waitFrames(m, count) {
  const { mem8 } = m;

  // Arm the countdown with the frame count, then enable the per-frame interrupt that ticks it.
  mem8[FRAME_WAIT_COUNTDOWN] = count;
  mem8[NMI_MASK_LATCH] = 1;

  // Spin until the countdown is ticked to zero, kicking the watchdog each pass.
  let remaining;
  do {
    mem8[WATCHDOG_KICK]; // kick the watchdog
    yield;        // wait one vblank (the interrupt decrements the countdown)
    remaining = mem8[FRAME_WAIT_COUNTDOWN]; // reload the countdown the interrupt is decrementing
  } while (remaining !== 0);

  return m.ret();
}
