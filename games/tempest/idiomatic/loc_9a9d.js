// SPDX-License-Identifier: GPL-3.0-only
import { loc_29, loc_2b, COORD_LIST_PTR_LO, COORD_LIST_PTR_HI, LIST_PTR_HI, LIST_SELECT_FLAGS, LIST_PTR_TABLE_LO, LIST_PTR_TABLE_LO1 } from "./names.js";
import { loc_9aee, loc_9af1 } from "./loc_9aee.js";

// Seed the demo list pointer pair from a fixed table byte and the held source cell,
// mark the index zero, and reload A from its holding cell.
export function loc_9a9d(m) {
  const { mem8 } = m;
  mem8[COORD_LIST_PTR_LO] = mem8[LIST_PTR_TABLE_LO];
  mem8[loc_2b] = 0x00;
  mem8[COORD_LIST_PTR_HI] = mem8[LIST_PTR_HI];
  return (m.regs.a = mem8[loc_29]);
}

// Alternate entry: fold two held bytes together into the low pointer value, then run the
// shared pointer-pair setup at index one.
export function loc_9aa9(m) {
  const { mem8 } = m;
  return loc_9af1(m, mem8[LIST_PTR_TABLE_LO1] | mem8[LIST_SELECT_FLAGS], 0x01);
}

// Alternate entry: run the shared pointer-pair setup at index four.
export function loc_9ab3(m) {
  return loc_9aee(m, 0x04);
}

// Alternate entry: run the shared pointer-pair setup at index three.
export function loc_9ab7(m) {
  return loc_9aee(m, 0x03);
}
