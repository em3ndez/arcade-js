// SPDX-License-Identifier: GPL-3.0-only
// Power-on self-test OBJRAM ramp fill: from the seed, write a stepped colour ramp (+0x2f per cell) across the
// 256-byte OBJRAM page, then reload the seed and re-scan the ramp to verify it.
import { OBJRAM_HW_BASE, RNG_SEED } from "./names.js";
import { loc_1bed } from "./loc_1bed.js";

const RAMP_STEP = 0x2f; // colour step laid between successive OBJRAM cells

export function loc_1be3(m, seed = m.regs.a) {
  const { mem8 } = m;
  let v = seed & 0xff;
  for (let i = 0; i < 0x100; i++) {
    mem8[OBJRAM_HW_BASE + i] = v;
    v = (v + RAMP_STEP) & 0xff;
  }
  return loc_1bed(m, mem8[RNG_SEED]); // reload the seed and scan the ramp back
}
