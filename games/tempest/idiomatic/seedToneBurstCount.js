// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { MODE_DISPATCH_SEL } from "./names.js";
import { runPowerOnToneBursts } from "./playPowerOnTone.js";

// Carries the incoming byte through as the burst count, derives a pass-seed from MODE_DISPATCH_SEL (values >= 0x20
// fold down by 0x18, then masked to five bits), and hands both to the power-on tone burst.
export function seedToneBurstCount(m, a = m.regs.a) {
  const { mem8 } = m;
  const count = a;
  let index = mem8[MODE_DISPATCH_SEL];
  if (index >= 0x20) index = u8(index - 0x18);
  index &= 0x1f;
  return runPowerOnToneBursts(m, count, index);
}
