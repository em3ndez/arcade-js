// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { GAME_MODE, SCRIPT_CURSOR, loc_298, MOTION_SCRIPT_TABLE } from "./names.js";

/**
 * writeScriptVariableToSlot — the motion-script "indirect store" opcode. ROM 0x9bdd.
 *
 * Role in the machine: companion to the immediate-store handler in Tempest's motion-script interpreter.
 * Where the immediate form copies a literal, this indirect form treats the next script byte as a pointer:
 * it names a zero-page variable, and the interpreter copies that variable's *current* value into the acting
 * object's slot. This lets a script wire a live game variable (loc_00-based zero page, e.g. the game-mode
 * region) into the field it is driving, so the stored value tracks state instead of being frozen.
 *
 * Behavior: advance the script cursor loc_10b by one, then read the script byte it now points at from the
 * table loc_a0f7. That byte is not a value but a zero-page address; index the zero page (loc_00 + ptr) to
 * fetch the live variable, and store that byte into the acting object's cell loc_298+x.
 *
 * Live-out: loc_10b (cursor advanced by one) and loc_298,x (= the live zero-page variable's value).
 * Grounding: [seen].
 */
export function writeScriptVariableToSlot(m, x = m.regs.x) {
  const { mem8 } = m;

  // Advance the rolling script cursor loc_10b by one.
  mem8[SCRIPT_CURSOR] = mem8[SCRIPT_CURSOR] + 1;

  const idx = mem8[SCRIPT_CURSOR];

  // Table byte doubles as a zero-page pointer index.
  const ptr = mem8[u16(MOTION_SCRIPT_TABLE + idx)];

  // Fetch the live variable at loc_00+ptr and copy it into slot x's cell.
  const value = mem8[u16(GAME_MODE + ptr)];

  mem8[u16(loc_298 + x)] = value;
}
