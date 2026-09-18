// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetVector — the power-on entry: the first thing the processor runs after reset, it
 * hands straight off to cold-boot init and never returns. On power-up execution begins
 * here; there is nothing to do but transfer control into the bring-up code, which re-seats
 * the stack, seeds work RAM, runs one-time setup, and falls into the attract flow forever.
 */

import { coldBootInit } from "./coldBootInit.js";

export function* resetVector(m) {
  // Nothing happens at the reset address itself — hand straight to cold-boot init, which
  // brings the machine up and never returns. It is a generator (yields at each vblank), so delegate with yield*.
  return yield* coldBootInit(m);
}
