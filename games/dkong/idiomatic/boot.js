// SPDX-License-Identifier: GPL-3.0-only
//
// boot — Donkey Kong's power-on sequence, then the game itself. It runs the boot
// initialisation (which stops right before the point where the machine would otherwise fall
// through into the main loop) and then delegates to the main loop with `yield*`.
//
// It is a GENERATOR, and that is what makes the shape work: the main loop yields once per
// vblank, and a yield suspends this whole call tree in place instead of unwinding it. So the
// frame driver resumes the game exactly where it left off, the host call stack stays flat no
// matter how deep the game is, and a warm restart is a matter of swapping the suspended
// generator rather than unwinding anything.

import { bootOnly } from "../translated/bootOnly.js";
import { mainLoop } from "./mainLoop.js";

export function* boot(m) {
  bootOnly(m); //          the power-on initialisation, stopping before the main loop
  yield* mainLoop(m); //   fall into the main loop
}
