// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2b, COORD_LIST_PTR_LO, COORD_LIST_PTR_HI, LIST_PTR_TABLE_HI, LIST_PTR_TABLE_LO } from "./names.js";

// Load a pointer pair from two tables indexed by Y into the low and high pointer cells,
// stash the index, and reload A from its holding cell. Sets up the indirect pointer that
// the coordinate walkers then chase.
export function seatCoordListPointer(m, y = m.regs.y) {
  const { mem8 } = m;
  mem8[COORD_LIST_PTR_LO] = mem8[u16(LIST_PTR_TABLE_LO + y)];
  mem8[COORD_LIST_PTR_HI] = mem8[u16(LIST_PTR_TABLE_HI + y)];
  mem8[loc_2b] = y;
  const a = mem8[loc_29];
  return (m.regs.a = a);
}

// The same setup entered one step later: take the low pointer straight from the caller
// instead of the fixed low table, then load the high pointer by index, stash the index,
// and reload A from its holding cell.
export function seatCoordListPointerWithLowByte(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[COORD_LIST_PTR_LO] = a;
  mem8[COORD_LIST_PTR_HI] = mem8[u16(LIST_PTR_TABLE_HI + y)];
  mem8[loc_2b] = y;
  return (m.regs.a = mem8[loc_29]);
}

// Entered past both table loads: the caller has already set the low pointer, so this takes the high
// pointer straight from A, stashes the index, and reloads A from its holding cell.
export function seatCoordListPointerWithHighByte(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_2b] = y;
  mem8[COORD_LIST_PTR_HI] = a;
  return (m.regs.a = mem8[loc_29]);
}
