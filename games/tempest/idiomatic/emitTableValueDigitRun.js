// SPDX-License-Identifier: GPL-3.0-only
import { seatInPagePointer } from "./seatInPagePointer.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";

/**
 * emitTableValueDigitRun -- seat a table pointer by index, then draw its three-byte value as
 * a digit run. ROM 0xb0c6.
 *
 * Role in the machine: the tube-well renderer (drawTubeWell, 0xaf81) draws the numeric depth
 * label beside each depth row. Each such value lives behind a pointer chosen from a ROM
 * pointer table by index. This routine is the two-step "look up the pointer, then print its
 * value" helper: it seats the in-page working pointer for the given table index, then emits
 * the pointed-at three-byte little value as on-screen digits.
 *
 * Behaviour: seatInPagePointer(x) (loc_91b5) doubles X into a word index, clears the paired
 * flag byte loc_29, and copies the little-endian pointer from ROM table 0x91c6/0x91c7 at that
 * index into the in-page working pointer 0x2a/0x2b. Then emitNibbleDigitRun(0x29, 0x03)
 * (loc_dfb1) walks three zeropage bytes from base 0x29 upward (top index 0x29+0x03-1 down),
 * emitting each byte high-nibble-then-low-nibble as a stroke glyph, chaining carry so only
 * the final low nibble sees carry cleared as the run terminator.
 *
 * Live-out: the in-page working pointer 0x2a/0x2b now points at the selected table value; the
 * flag byte 0x29 is cleared; the display list gains the emitted digit words and its cursor
 * (loc_74) advances. Grounding: [seen].
 */
// Select a pointer from the table by index, then emit a three-byte zeropage run as nibbles.
export function emitTableValueDigitRun(m, x = m.regs.x) {
  seatInPagePointer(m, x);                    // loc_91b5: load working pointer 0x2a/0x2b from ROM table[x]
  emitNibbleDigitRun(m, 0x29, 0x03);          // loc_dfb1: print three zeropage bytes from 0x29 as nibble digits
}
