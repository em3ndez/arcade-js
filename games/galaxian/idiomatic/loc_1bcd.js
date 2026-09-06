// SPDX-License-Identifier: GPL-3.0-only
// Power-on self-test mode dispatch, run by the vblank service while the self-test mode is nonzero. Mode 1
// runs the sound + input scan, mode 2 advances the screen-fill strip, mode 3 fills and scans the OBJRAM
// ramp; any other value is the reset arm, unreachable on a good boot.
import { RNG_SEED } from "./names.js";
import { driveSoundFrameAndScanInput } from "./driveSoundFrameAndScanInput.js";
import { advanceScreenFillStrip } from "./advanceScreenFillStrip.js";
import { loc_1be3 } from "./loc_1be3.js";

export function loc_1bcd(m, mode = m.regs.a) {
  if (mode === 1) return driveSoundFrameAndScanInput(m);
  if (mode === 2) return advanceScreenFillStrip(m);
  if (mode !== 3) throw new Error(`self-test mode ${mode}: the reset arm is unreachable on a good boot`);
  return loc_1be3(m, m.mem8[RNG_SEED]); // mode 3: fill + scan the OBJRAM ramp
}
