// SPDX-License-Identifier: GPL-3.0-only
import { loc_29, loc_2b, COORD_LIST_PTR_LO, COORD_LIST_PTR_HI, LIST_PTR_HI, LIST_SELECT_FLAGS, LIST_PTR_TABLE_LO, LIST_PTR_TABLE_LO1 } from "./names.js";
import { seatCoordListPointer, seatCoordListPointerWithLowByte } from "./seatCoordListPointer.js";

/**
 * seatDemoCoordListPointer -- seat the index-0 coordinate list. ROM 0x9a9d.
 *
 * Role in the machine: the index-0 entry of the coordinate-list setup family reached from
 * dispatchCoordListSetup (which routes an incoming value to one of five entries). Where the shared
 * 0x9aee seater pulls both address halves from the parallel ROM tables, this entry seeds the pointer
 * pair a bit differently: the low byte still comes from the fixed head of the low ROM table, but the
 * high byte is taken from a live held source cell $15d rather than the high table -- letting the demo
 * list's high half be steered at runtime.
 *
 * Behavior: copy the fixed table byte LIST_PTR_TABLE_LO ($9b02, index 0) into $2c (COORD_LIST_PTR_LO).
 * Mark the selecting index as zero at $2b (loc_2b). Copy the held source cell LIST_PTR_HI ($15d) into
 * $2d (COORD_LIST_PTR_HI). Reload A from the holding cell $29 (loc_29) and return it.
 *
 * Live-out: the coordinate-list pointer $2c/$2d, the zeroed index $2b, and A reloaded from $29.
 * Grounding: [seen].
 */
export function seatDemoCoordListPointer(m) {
  const { mem8 } = m;
  mem8[COORD_LIST_PTR_LO] = mem8[LIST_PTR_TABLE_LO];         // low byte from fixed table head 0x9b02
  mem8[loc_2b] = 0x00;                                       // selecting index = 0
  mem8[COORD_LIST_PTR_HI] = mem8[LIST_PTR_HI];               // high byte from held source cell 0x15d
  return (m.regs.a = mem8[loc_29]);                          // reload A from its holding cell
}

/**
 * loc_9aa9 -- the index-1 coordinate-list setup entry. ROM 0x9aa9.
 *
 * Role in the machine: another entry reached from dispatchCoordListSetup. Rather than take the list's
 * low byte from a table, it composes the low byte at runtime by OR-folding a second fixed table byte
 * with the current list-select flags, then hands that computed low byte to the "with low byte" seater
 * at index 1 -- so which coordinate list is chased depends on the live select flags.
 *
 * Behavior: OR LIST_PTR_TABLE_LO1 with LIST_SELECT_FLAGS to form the low pointer byte and call
 * seatCoordListPointerWithLowByte with that value and Y = 1, which parks it at $2c, pulls the high
 * byte from the high ROM table at index 1, stashes the index, and reloads A.
 *
 * Live-out: (via the shared seater) the coordinate-list pointer $2c/$2d, the stashed index $2b = 1,
 * and A reloaded from $29. Grounding: [seen].
 */
export function loc_9aa9(m) {
  const { mem8 } = m;
  return seatCoordListPointerWithLowByte(m, mem8[LIST_PTR_TABLE_LO1] | mem8[LIST_SELECT_FLAGS], 0x01);
}

/**
 * loc_9ab3 -- the index-4 coordinate-list setup entry. ROM 0x9ab3.
 *
 * Role in the machine: the simplest of the dispatchCoordListSetup entries -- it just presets the
 * selecting index to 4 and falls into the shared 0x9aee seater, which fetches both address halves
 * from the parallel ROM tables at index 4 ($9b02[4] low, $9afd[4] high).
 *
 * Live-out: (via seatCoordListPointer) the coordinate-list pointer $2c/$2d, the stashed index $2b = 4,
 * and A reloaded from $29. Grounding: [seen].
 */
export function loc_9ab3(m) {
  return seatCoordListPointer(m, 0x04);                      // shared seating at index 4
}

/**
 * seatCoordListPointerAtIndex3 -- the index-3 coordinate-list setup entry. ROM 0x9ab7.
 *
 * Role in the machine: the dispatchCoordListSetup entry that presets the selecting index to 3 and runs
 * the shared 0x9aee seating, parking the coordinate-list pointer $2c/$2d from ROM tables $9b02[3] (low)
 * and $9afd[3] (high).
 *
 * Live-out: (via seatCoordListPointer) the coordinate-list pointer $2c/$2d, the stashed index $2b = 3,
 * and A reloaded from $29. Grounding: [seen].
 */
export function seatCoordListPointerAtIndex3(m) {
  return seatCoordListPointer(m, 0x03);                      // shared seating at index 3
}
