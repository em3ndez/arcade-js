// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2b, COORD_LIST_PTR_LO, COORD_LIST_PTR_HI, LIST_PTR_TABLE_HI, LIST_PTR_TABLE_LO } from "./names.js";

/**
 * seatCoordListPointer -- aim the coordinate-list pointer $2c/$2d at a packed vector list. ROM 0x9aee.
 *
 * Role in the machine: Tempest's enemies and web shapes are drawn/walked from packed coordinate lists
 * in ROM. Before a walker can chase one, its 16-bit head address must be seated in the zero-page
 * pointer pair $2c/$2d (COORD_LIST_PTR_LO/HI). This is the full seater: given a selecting index in Y,
 * it fetches both halves of the list address from the parallel ROM tables (low bytes at $9b02, high
 * bytes at $9afd) and installs them, so the coordinate walkers can then dereference $2c/$2d.
 *
 * Behavior: read LIST_PTR_TABLE_LO+Y ($9b02+Y) into $2c and LIST_PTR_TABLE_HI+Y ($9afd+Y) into $2d.
 * Remember the selecting index Y at $2b (loc_2b) for later reference. Reload A from its holding cell
 * $29 (loc_29) and return it -- restoring the accumulator the 6502 caller expects.
 *
 * Live-out: the coordinate-list pointer $2c/$2d, the stashed index $2b, and A reloaded from $29.
 * Grounding: [seen].
 */
export function seatCoordListPointer(m, y = m.regs.y) {
  const { mem8 } = m;
  mem8[COORD_LIST_PTR_LO] = mem8[u16(LIST_PTR_TABLE_LO + y)]; // low byte from ROM table 0x9b02+Y
  mem8[COORD_LIST_PTR_HI] = mem8[u16(LIST_PTR_TABLE_HI + y)]; // high byte from ROM table 0x9afd+Y
  mem8[loc_2b] = y;                                          // remember the selecting index
  const a = mem8[loc_29];                                    // reload A from its holding cell
  return (m.regs.a = a);
}

/**
 * seatCoordListPointerWithLowByte -- the same seating entered one step in. ROM 0x9af1.
 *
 * Role in the machine: an alternate entry into seatCoordListPointer for callers that have already
 * computed the list's low address byte themselves (e.g. by folding two source bytes together). It
 * skips the low-table lookup and takes the low pointer straight from A, then completes the same
 * pointer-pair install so the coordinate walkers see an identically seated $2c/$2d.
 *
 * Behavior: store the caller-supplied low byte A straight into $2c (COORD_LIST_PTR_LO). Pull the high
 * byte from LIST_PTR_TABLE_HI+Y ($9afd+Y) into $2d. Stash the index Y at $2b (loc_2b) and reload A
 * from the holding cell $29 (loc_29), returning it.
 *
 * Live-out: the coordinate-list pointer $2c/$2d, the stashed index $2b, and A reloaded from $29.
 * Grounding: [seen].
 */
export function seatCoordListPointerWithLowByte(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[COORD_LIST_PTR_LO] = a;                              // low byte straight from the caller
  mem8[COORD_LIST_PTR_HI] = mem8[u16(LIST_PTR_TABLE_HI + y)]; // high byte from ROM table 0x9afd+Y
  mem8[loc_2b] = y;                                          // remember the selecting index
  return (m.regs.a = mem8[loc_29]);                          // reload A from its holding cell
}

/**
 * seatCoordListPointerWithHighByte -- the seating at its deepest entry. ROM 0x9af6.
 *
 * Role in the machine: the innermost alternate entry into the seater, for callers that have already
 * parked the list's low byte at $2c themselves and hold the high byte in A. It performs only the
 * remaining tail of the install, so no table is consulted at all -- both pointer halves come entirely
 * from the caller.
 *
 * Behavior: stash the index Y at $2b (loc_2b). Take the high byte straight from A into $2d
 * (COORD_LIST_PTR_HI). Reload A from the holding cell $29 (loc_29) and return it.
 *
 * Live-out: the coordinate-list pointer high byte $2d (low $2c was set by the caller), the stashed
 * index $2b, and A reloaded from $29. Grounding: [seen].
 */
export function seatCoordListPointerWithHighByte(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_2b] = y;                                          // remember the selecting index
  mem8[COORD_LIST_PTR_HI] = a;                              // high byte straight from the caller
  return (m.regs.a = mem8[loc_29]);                          // reload A from its holding cell
}
