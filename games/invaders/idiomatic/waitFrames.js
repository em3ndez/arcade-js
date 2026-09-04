// SPDX-License-Identifier: GPL-3.0-only
import { FRAME_DELAY_TIMER } from "./names.js";

// Seed the vblank busy-wait counter with `a` and yield until the interrupt handler drains it to zero.
// Generator: each yield is one displayed frame, during which the handler decrements the counter.
// Memory-only.
export function* waitFrames(m, a) {
  m.mem8[FRAME_DELAY_TIMER] = a;
  while (m.mem8[FRAME_DELAY_TIMER] !== 0) yield;
}
