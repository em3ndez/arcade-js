// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_44, loc_54, loc_64, loc_8b } from "./names.js";

/**
 * loadObjectTileInputs — marshal one object slot's position and heading for the tile-cell probe.
 * Copies the slot's base byte into scratch cell $8b, derives a ±1 step from the sign of the
 * heading byte (0xff when the sign bit is set, else 0x01) and returns it in Y, and loads the
 * slot's coordinate byte into A. A leaf: one store, two register outputs, no sub-calls. [code]
 */
export function loadObjectTileInputs(m, x = m.regs.x) {
  const { mem8, regs } = m;
  // Read the base byte before storing, so a slot whose base cell is $8b still aliases exactly.
  mem8[loc_8b] = mem8[u8(loc_54 + x)];
  // step = 0xff when the heading's sign bit is set, else 0x01.
  const step = mem8[u8(loc_44 + x)] & 0x80 ? 0xff : 0x01;
  // Publish both register outputs: Y = the step, A = the slot's coordinate byte.
  return [(regs.y = step), (regs.a = mem8[u8(loc_64 + x)])];
}
