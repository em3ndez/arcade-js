// SPDX-License-Identifier: GPL-3.0-only
//
// boot — Donkey Kong's power-on sequence, then the game itself: run boot initialisation (which
// stops right before the fall-through into the main loop), then delegate to the main loop.
//
// It is a GENERATOR, and that is what makes the shape work: the main loop yields once per vblank,
// and a yield suspends this whole call tree in place instead of unwinding it — so the frame driver
// resumes exactly where it left off, the host stack stays flat however deep the game is, and a
// warm restart just swaps the suspended generator.

import { bootOnly } from "../translated/bootOnly.js";
import { mainLoop } from "./mainLoop.js";

export function* boot(m) {
  bootOnly(m); // power-on init, stopping before the main loop
  yield* mainLoop(m);
}
