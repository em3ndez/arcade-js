// SPDX-License-Identifier: GPL-3.0-only
/**
 * coldBoot -- the power-on reset: mask the vblank interrupt, then run the whole cold-boot sequence.
 *
 * WHAT IT IS
 *   The first code the machine runs. It clears the interrupt-enable latch so no vblank interrupt can fire
 *   while the board is being wiped and tested, then hands the rest of power-on to the hardware wipe, which
 *   carries straight on through the RAM tests and the ROM checksum into the main loop.
 *
 * ROLE IN THE MACHINE
 *   The reset vector. Nothing here returns to a caller: the chain it starts ends by handing control to the
 *   main-loop generator, and that generator is what this call gives back to the frame engine.
 *
 * ROM 0x0000 (reset vector).  Grounding: [seen]. Cell: IRQ_ENABLE (0x7001).
 *
 * LIVE-OUT: memory and the hardware latches, as left by the cold-boot chain; returns the main-loop generator.
 */
import { IRQ_ENABLE } from "./names.js";
import { wipeVideoAndHardwareLatches } from "./wipeVideoAndHardwareLatches.js";

export function coldBoot(m) {
  m.mem8[IRQ_ENABLE] = 0; // no vblank interrupt until boot re-arms it at the very end
  return wipeVideoAndHardwareLatches(m);
}
