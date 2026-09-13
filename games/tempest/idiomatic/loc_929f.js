// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SHAPE_ACTIVE, TIMED_OBJECT_COUNT } from "./names.js";

// Reset leaf: zero an 8-byte table and one flag byte to their baseline.
export function loc_929f(m) {
  const { mem8 } = m;
  // Blank the 8-byte table top-down.
  for (let x = 7; x >= 0; x--) mem8[u16(SHAPE_ACTIVE + x)] = 0x00;
  // Clear the trailing flag byte.
  mem8[TIMED_OBJECT_COUNT] = 0x00;
}
