// SPDX-License-Identifier: GPL-3.0-only
import { SCRIPT_CURSOR, MOTION_SCRIPT_TABLE, loc_298 } from "./names.js";
import { u16 } from "../../../core/int.js";

/**
 * writeScriptConstantToSlot — the motion-script "immediate store" opcode. ROM 0x9bd0.
 *
 * Role in the machine: Tempest animates enemies and effects with a small bytecode interpreter that walks a
 * motion-script table (loc_a0f7) via a rolling cursor (loc_10b). This handler implements the immediate-store
 * instruction: it takes the next literal byte out of the script stream and drops it straight into the acting
 * object's per-slot cell, giving a script a way to assign a constant to whatever field it is driving.
 *
 * Behavior: advance the script cursor loc_10b by one, wrapping at a byte boundary (& 0xff), and store the
 * new cursor back. Then read the script byte the cursor now points at — loc_a0f7[cursor] — and copy it
 * verbatim into the acting object's cell loc_298+x. No interpretation of the byte; it is the value.
 *
 * Live-out: loc_10b (cursor advanced by one) and loc_298,x (= the fetched constant). Grounding: [seen].
 */
export function writeScriptConstantToSlot(m, x = m.regs.x) {
  const { mem8 } = m;
  // Advance the rolling script cursor loc_10b one step, wrapping within a byte.
  const index = (mem8[SCRIPT_CURSOR] + 1) & 0xff;
  mem8[SCRIPT_CURSOR] = index;
  // The byte the cursor now selects is the literal — store it straight into slot x's cell.
  mem8[u16(loc_298 + x)] = mem8[u16(MOTION_SCRIPT_TABLE + index)];
}
