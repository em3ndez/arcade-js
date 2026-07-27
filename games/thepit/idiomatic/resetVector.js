// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetVector — the power-on entry: the very first thing the processor runs after
 * reset, it hands straight off to cold-boot init and never comes back.  ROM 0x0000.
 *
 * On power-up the processor begins executing at this address. There is nothing to do
 * here except transfer control into the real bring-up code, which re-seats the stack,
 * seeds work RAM, runs the one-time screen / table / sound setup, and falls into the
 * attract flow that runs forever — so control never returns to this vector.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0000.test.js.
 * GATE:     crafted-entry — the real reset dispatch is captured from a boot run (the
 *           first instruction after power-on); the still-oracle reset/entry handler the
 *           boot tail eventually reaches (0x01f9) is stubbed to a no-op identically on
 *           both arms so the otherwise-endless boot cascade terminates, and the
 *           frame-wait holds are driven by one identical per-frame countdown tick. RAM
 *           diff outside the dead stack-scratch window around the re-seated stack top;
 *           pc/SP/registers excluded per the memory-equivalence contract. Reached once,
 *           at cold boot.
 * LIVE-OUT: memory-only — everything the delegated cold-boot init leaves in work /
 *           colour / video / sprite RAM. Nothing reads a register back: the vector only
 *           hands off, and the boot it starts never returns here.
 * NAMES:    none — this vector touches no RAM of its own; it only delegates.
 */

import { coldBootInit } from "./coldBootInit.js";

export function resetVector(m) {
  // Nothing happens at the reset address itself — hand straight to cold-boot init,
  // which brings the machine up and runs the game; it never returns here.
  return coldBootInit(m);
}
