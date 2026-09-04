// SPDX-License-Identifier: GPL-3.0-only
import { loc_2048 } from "./names.js";

/**
 * loc_067e — store a 16-bit pointer into a fixed work-RAM cell.
 *
 * WHAT IT IS
 *   A one-instruction leaf: it writes the 16-bit value in HL into the work-RAM word at loc_2048 (0x2048)
 *   and returns. Nothing else — no IO, no branching.
 *
 * ROLE IN THE MACHINE
 *   Reached by a `jmp 0x067e` from ROM 0x050b. It parks whatever pointer the caller holds into the
 *   loc_2048 cell for a later consumer. The routine keeps its loc_ name, and loc_2048 keeps its loc_ name,
 *   because the cell's game-role is not confidently recovered from the code alone (see names.js — both are
 *   still placeholders).
 *
 * ROM 0x067e-0x0681.  Grounding: [seen] (names.js cert — the store is confirmed; the cell's meaning is not).
 *
 * LIVE-OUT: memory only (loc_2048 := HL); the engine seam completes the return.
 */
export function loc_067e(m, hl = m.regs.hl) {
  // Store the 16-bit HL into the loc_2048 work-RAM word (m.mem16 writes low byte then high byte).
  m.mem16[loc_2048] = hl;
}
