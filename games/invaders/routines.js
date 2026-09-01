// SPDX-License-Identifier: GPL-3.0-only
// Space Invaders translated routines (addr -> fn(machine, ...)). Filled by the §3 translation pass, one
// routine per 8080 ROM range as it is decompiled from out/dk.asm and diffed boot-first vs the MAME golden.
import { loc_0000 } from "./translated/loc_0000.js";
import { loc_18d4 } from "./translated/loc_18d4.js";

export function buildRoutines() {
  const r = new Map();
  r.set(0x0000, loc_0000); // reset -> jmp 0x18d4 (init)
  r.set(0x18d4, loc_18d4); // boot init -> calls 0x01e6, 0x1956, delegates to 0x18df
  return r;
}
