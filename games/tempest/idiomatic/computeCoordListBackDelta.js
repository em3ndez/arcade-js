// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_2b, loc_29, COORD_LIST_PTR_LO } from "./names.js";

/**
 * computeCoordListBackDelta — difference against a coordinate-list byte two slots back. ROM 0x96f4.
 *
 * Role in the machine: a small arithmetic leaf over one of Tempest's indirected coordinate lists (base
 * pointer in the zero-page word at $2c, COORD_LIST_PTR_LO). Given a cursor Y, it forms the signed 8-bit
 * difference between a scratch base value ($2b) and the list entry located two positions before the cursor.
 * The result feeds the downstream selector below and drives geometry stepping along the list.
 *
 * Behavior: read base from $2b; stash the current cursor Y into $29 (so a caller can recover it); index the
 * list through mem16[$2c] at offset (Y-2) & 0xff — the "two slots back" byte; return (base - operand) & 0xff.
 *
 * Live-out: $29 := Y. Returns the wrapped delta. Grounding: [seen].
 */
export function computeCoordListBackDelta(m, y = m.regs.y) {
  const { mem8, mem16 } = m;
  const base = mem8[loc_2b];                                           // scratch base value at $2b
  mem8[loc_29] = y;                                                    // record the cursor index at $29
  const operand = mem8[u16(mem16[COORD_LIST_PTR_LO] + ((y - 2) & 0xff))]; // list byte two slots back
  return (base - operand) & 0xff;                                     // wrapped 8-bit difference
}

/**
 * selectListEntryByDeltaParity — pick a list entry, nudged by the delta's parity. ROM 0x9700.
 *
 * Role in the machine: sibling entry point sharing the same coordinate list. It computes the back-delta
 * above, then uses only its low bit as a one-slot cursor adjustment before fetching the entry the cursor now
 * points at — a parity-driven fork between two neighbouring list entries.
 *
 * Behavior: delta = computeCoordListBackDelta(Y); if the delta is odd (bit 0 set) advance the cursor Y by 1;
 * return the list entry at mem16[$2c] + Y.
 *
 * Live-out: $29 := Y (via the callee). Returns the selected list byte. Grounding: [seen].
 */
export function selectListEntryByDeltaParity(m, y = m.regs.y) {
  const { mem8, mem16 } = m;
  const delta = computeCoordListBackDelta(m, y);       // also stashes Y into $29
  if (delta & 0x01) y = u8(y + 1);                     // odd delta -> step to the next slot
  return mem8[u16(mem16[COORD_LIST_PTR_LO] + y)];      // entry the (possibly advanced) cursor points at
}
