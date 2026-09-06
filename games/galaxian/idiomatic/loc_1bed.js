// SPDX-License-Identifier: GPL-3.0-only
// Power-on self-test ramp scan: verify each OBJRAM cell equals the stepped ramp (+0x2f per cell); a mismatch
// is a RAM fault, unreachable on good RAM. On a clean pass pet the watchdog, advance the RNG, and count the
// self-test passes down; on the final pass clear OBJRAM and seed the machine into the next boot phase.
import { OBJRAM_HW_BASE, WATCHDOG_RESET, VRAM_BASE, SELFTEST_MODE, FRAME_COUNTER, OBJECT_DRAW_SUPPRESS,
  START_LAMP_0, START_LAMP_1, COIN_LOCKOUT, loc_4008, loc_4006, loc_4226 } from "./names.js";
import { advanceRandomSeed } from "./advanceRandomSeed.js";

const RAMP_STEP = 0x2f;

export function loc_1bed(m, seed = m.regs.a) {
  const { mem8 } = m;
  let v = seed & 0xff;
  for (let i = 0; i < 0x100; i++) {
    if (mem8[OBJRAM_HW_BASE + i] !== v) throw new Error(`self-test ramp mismatch at OBJRAM+${i} (RAM fault, unreachable on good RAM)`);
    v = (v + RAMP_STEP) & 0xff;
  }
  void mem8[WATCHDOG_RESET]; // kick the watchdog
  advanceRandomSeed(m);
  const remaining = (mem8[loc_4008] - 1) & 0xff;
  mem8[loc_4008] = remaining;
  if (remaining !== 0) return; // more self-test passes owed

  // final pass: clear OBJRAM, then seed the machine into the next boot phase
  for (let i = 0; i < 0x100; i++) mem8[OBJRAM_HW_BASE + i] = 0;
  mem8[loc_4006] = 1;
  mem8[SELFTEST_MODE] = 1;
  mem8[START_LAMP_0] = 1;
  mem8[START_LAMP_1] = 1;
  mem8[COIN_LOCKOUT] = 1;
  mem8[loc_4226] = 1;
  mem8[FRAME_COUNTER] = 1;
  mem8[OBJECT_DRAW_SUPPRESS] = 1;
  mem8[VRAM_BASE + 0x213] = 0x1f;
  mem8[VRAM_BASE + 0x1f3] = 0x1b;
}
