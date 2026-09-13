// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ACTIVE_ENEMY_COUNT, ACTIVE_OBJECT_COUNT, SLOT_STATE } from "./names.js";

// Reset leaf: zero a 12-byte block and two flag cells to their baseline.
export function loc_928f(m) {
  const { mem8 } = m;
  // Clear the 12-byte array.
  for (let x = 0x0b; x >= 0; x--) mem8[u16(SLOT_STATE + x)] = 0x00;
  // Clear the two associated flag cells.
  mem8[ACTIVE_OBJECT_COUNT] = 0x00;
  mem8[ACTIVE_ENEMY_COUNT] = 0x00;
}
