// SPDX-License-Identifier: GPL-3.0-only
//
// boot — Donkey Kong's power-on sequence, then the game itself: run boot initialisation (which
// stops right before the fall-through into the main loop), then delegate to the main loop.
//
// It is a GENERATOR, and that is what makes the shape work: the main loop yields once per vblank,
// and a yield suspends this whole call tree in place instead of unwinding it — so the frame driver
// resumes exactly where it left off, the host stack stays flat however deep the game is, and a
// warm restart just swaps the suspended generator.

import { NMI_ENABLE } from "./names.js";
import { clearRamAndInitHardware } from "./clearRamAndInitHardware.js";
import { mainLoop } from "./mainLoop.js";

/** Power-on init up to the main loop: mask vblank, then the RAM wipe + hardware setup (which
 *  re-arms vblank as its last act). LIVE-OUT: memory and the hardware latches. */
export function bootInit(m) {
  m.mem8[NMI_ENABLE] = 0;
  clearRamAndInitHardware(m);
}

export function* boot(m) {
  bootInit(m);
  yield* mainLoop(m);
}
