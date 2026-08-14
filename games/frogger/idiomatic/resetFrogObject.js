// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetFrogObject — reset the frog object block and its state flags.
 *
 * Writes the four object bytes, clears four state cells, sets the ready flag.
 * LIVE-OUT: memory + A (the ready-flag value, consumed by the render caller).
 */
import { loc_8044, loc_83cd, loc_842d, loc_842c, loc_8269, loc_83c3 } from "./names.js";

const OBJECT_INIT = [128, 30, 3, 224];

export function resetFrogObject(m) {
  const { mem8 } = m;
  for (let i = 0; i < OBJECT_INIT.length; i++) mem8[(loc_8044 + i) & 0xffff] = OBJECT_INIT[i];
  mem8[loc_83cd] = 0;
  mem8[loc_842d] = 0;
  mem8[loc_842c] = 0;
  mem8[loc_8269] = 0;
  mem8[loc_83c3] = 1;
  m.regs.a = 1;
}
