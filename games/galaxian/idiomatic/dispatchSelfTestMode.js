// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchSelfTestMode (ROM 0x1bcd) -- the alternate per-frame handler for the boot self-test and
 * screen-fill phases.
 *
 * WHAT IT IS
 *   When SELFTEST_MODE (0x401a) is nonzero the vblank service diverts the whole frame here instead of
 *   the normal game path. It is a small one-of-four dispatch keyed on that flag: mode 1 runs the sound
 *   driver + input scan, mode 2 advances the tile-strip screen fill one strip, and mode 3 fills the
 *   OBJRAM color ramp. Any other value is the invalid/reset arm -- on a good boot it is unreachable
 *   (the ROM would drop to the cold-reset vector at 0x0000). Whichever handler it picks returns through
 *   the same exit epilogue the main path uses, so the interrupt is still re-armed and registers
 *   restored.
 *
 * ROLE IN THE MACHINE
 *   The boot walks the mode 3->1->2->0 before normal play begins, so this handler drives the power-on
 *   self-test and the initial screen clear. Mode 3 seeds its color ramp from RNG_SEED (0x401e), stepping
 *   the color across the 256-byte OBJRAM page from the object hardware base.
 *
 * ROM 0x1bcd.  Grounding: [seen].
 *
 * LIVE-OUT: whatever the selected sub-handler leaves; throws (the ROM's cold reset) on an invalid mode.
 */
import { RNG_SEED } from "./names.js";
import { driveSoundFrameAndScanInput } from "./driveSoundFrameAndScanInput.js";
import { advanceScreenFillStrip } from "./advanceScreenFillStrip.js";
import { fillObjRamTestRamp } from "./fillObjRamTestRamp.js";

export function dispatchSelfTestMode(m, mode = m.regs.a) {
  // mode 1: tick the sound driver + decaying sweep, pet the watchdog, and scan IN0 for its arm bits.
  if (mode === 1) return driveSoundFrameAndScanInput(m);
  // mode 2: paint one strip of the tile-strip screen fill.
  if (mode === 2) return advanceScreenFillStrip(m);
  // Modes 1/2 handled; only 3 remains valid. Anything else is the reset arm -- a good boot never sees it.
  if (mode !== 3) throw new Error(`self-test mode ${mode}: the reset arm is unreachable on a good boot`);
  // mode 3: fill the OBJRAM color ramp, seeded from RNG_SEED (0x401e), across the 256-byte OBJRAM page.
  return fillObjRamTestRamp(m, m.mem8[RNG_SEED]); // mode 3: fill + scan the OBJRAM ramp
}
