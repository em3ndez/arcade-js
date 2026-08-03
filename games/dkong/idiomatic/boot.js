// SPDX-License-Identifier: GPL-3.0-only
//
// boot (ROM 0x0000) as a GENERATOR for the coroutine go-live engine (core/frame-stepped.js
// runGeneratorGame). It runs Donkey Kong's boot init — reset (0x0000) through the end of boot
// setup (0x02BC), via the translated `bootOnly`, which stops right before the fall-through into
// the main loop — then delegates to the mainLoop generator with `yield*`. Because the spine is a
// generator, a vblank yield suspends the whole call tree and warm restarts swap the main generator,
// so the JS host stack stays flat (see runGeneratorGame).

import { bootOnly } from "../translated/bootOnly.js";
import { mainLoop } from "./mainLoop.js";

export function* boot(m) {
  bootOnly(m); //          boot init 0x0000–0x02BC (returns at 0x02BC, before the main-loop fall-through)
  yield* mainLoop(m); //   fall into the main loop
}
