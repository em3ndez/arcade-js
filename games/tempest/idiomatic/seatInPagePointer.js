// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_29, loc_2a, loc_2b, POINTER_TABLE_LO, POINTER_TABLE_HI } from "./names.js";

/**
 * seatInPagePointer -- seat the in-page working pointer $2a/$2b from a selector. ROM 0x91b5.
 *
 * Role in the machine: many of Tempest's draw and walk routines chase an indirect pointer parked in
 * the zero-page working slot $2a/$2b. This routine is the setup step that installs that pointer: given
 * a small selector in A, it doubles it into a word index and copies the matching little-endian pointer
 * out of the in-page ROM table (low bytes at $91c6, high bytes at $91c7, interleaved by stride 2), so
 * the caller can then dereference $2a/$2b to reach the selected structure.
 *
 * Behavior: shift the selector A left one to turn it into a byte offset into the interleaved table
 * (u8-wrapped). Clear the paired flag byte $29 (loc_29) that travels with this pointer. Copy the low
 * pointer byte from POINTER_TABLE_LO+index into $2a and the high byte from POINTER_TABLE_HI+index into
 * $2b.
 *
 * Live-out: the working pointer $2a/$2b (loc_2a/loc_2b) and the cleared flag byte $29 (loc_29).
 * Grounding: [seen].
 */
export function seatInPagePointer(m, a = m.regs.a) {
  const { mem8 } = m;
  const index = u8(a << 1);                                  // selector -> two-byte table stride
  mem8[loc_29] = 0;                                          // clear the paired flag byte
  mem8[loc_2a] = mem8[u16(POINTER_TABLE_LO + index)];        // pointer low byte
  mem8[loc_2b] = mem8[u16(POINTER_TABLE_HI + index)];        // pointer high byte
}
