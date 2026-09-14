// SPDX-License-Identifier: GPL-3.0-only
import { COORD_LIST_PTR_LO, ENEMY_CLIMB_DELTA_LO_0 } from "./names.js";
import { u16 } from "../../../core/int.js";

/**
 * resolveCoordListEntryToAbsolute -- turn one coordinate-list entry into an absolute coordinate. ROM 0x96db.
 *
 * Role in the machine: Tempest lays enemies and shots out along the tube as lists of relative
 * offsets. A list is addressed by the 16-bit pointer $2c/$2d, and $160 holds the running base
 * (the depth/position the list is anchored to). This helper fetches the Y-th entry of the list and
 * folds it onto that base, producing the concrete on-tube coordinate a mover or drawer can use.
 *
 * Behavior: load the list pointer from $2c (COORD_LIST_PTR_LO, read 16-bit), index it by Y to read one
 * list byte, add the base value at $160 (ENEMY_CLIMB_DELTA_LO_0), and mask the sum to 8 bits. The wrap
 * on 0xff is real 6502 add-with-carry behavior kept faithfully.
 *
 * Live-out: the 8-bit sum is returned and left in A for the caller; no memory is written.
 * Grounding: seen.
 */
export function resolveCoordListEntryToAbsolute(m, y = m.regs.y) {
  const { mem8, mem16 } = m;
  const ptr = mem16[COORD_LIST_PTR_LO]; // 16-bit list base pointer at $2c/$2d
  const value = mem8[u16(ptr + y)];     // Y-th relative entry of the list
  // Fold the relative entry onto the anchor base at $160, wrapping at 8 bits (ADC semantics).
  return (m.regs.a = (value + mem8[ENEMY_CLIMB_DELTA_LO_0]) & 0xff);
}
