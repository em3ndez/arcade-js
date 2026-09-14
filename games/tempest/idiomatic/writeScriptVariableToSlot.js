// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { GAME_MODE, SCRIPT_CURSOR, loc_298, MOTION_SCRIPT_TABLE } from "./names.js";

// Advance the rolling counter, use it to select a table byte, treat that byte as a
// zero-page pointer, and copy the pointed-at byte into slot X's cell.
export function writeScriptVariableToSlot(m, x = m.regs.x) {
  const { mem8 } = m;

  mem8[SCRIPT_CURSOR] = mem8[SCRIPT_CURSOR] + 1;

  const idx = mem8[SCRIPT_CURSOR];

  // Table byte doubles as a zero-page pointer index.
  const ptr = mem8[u16(MOTION_SCRIPT_TABLE + idx)];

  const value = mem8[u16(GAME_MODE + ptr)];

  mem8[u16(loc_298 + x)] = value;
}
