// SPDX-License-Identifier: GPL-3.0-only
/**
 * writePackedBcdWord  —  ROM 0x0b9b  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The four-digit rung of Frogger's readout ladder. A 16-bit packed-BCD word carries four decimal
 *   digits — two per byte, tens in each byte's high nibble and ones in its low nibble. This routine prints
 *   that word as four on-screen numerals, most-significant first, by handing each byte in turn to the
 *   two-digit rung writePackedBcdByte (0x0ba0): the HIGH byte's two digits, then the LOW byte's two. It is
 *   pure sequencing — every actual tilemap write and pointer step happens one and two levels below it.
 *
 * WHERE IT SITS
 *   The middle-upper rung of the digit-printing family — one level below the field printer, one level above
 *   the two-digit rung:
 *       writeScoreField (0x0b95)  →  [this]  →  writePackedBcdByte (0x0ba0)  →  writeScoreDigitStepUp (0x0ba9)
 *   writeScoreField calls this to lay down a score's four significant digits before appending its fixed
 *   trailing "0"; the score/high-score/credit-target/point-target printers all reach the screen through
 *   here. It owns no memory cell and imports no names.js const — the atom does all the real work.
 *
 * WHY HIGH BYTE FIRST
 *   The atom steps the write pointer UP one 32-cell tilemap row after each numeral (one character cell along
 *   this rotated, Galaxian-derived display), and writePackedBcdByte threads that stepped pointer from its
 *   first digit into its second. Emitting the high byte before the low therefore lays the four numerals out
 *   in reading order — thousands, hundreds, tens, ones — and leaves the pointer already four cells on, so
 *   the caller's next field needs no pointer reload.
 *
 * LIVE-OUT
 *   Memory (the four tilemap cells the atom stamps) AND HL — the write pointer advanced four rows past this
 *   word. We thread the pointer returned by the high-byte call into the low-byte call, and return the
 *   low-byte call's result, so the caller reads the final position straight from HL without recomputing it.
 */
import { writePackedBcdByte } from "./writePackedBcdByte.js";

// value / ptr default to the Z80 registers the ROM routine reads (DE = the packed-BCD word, HL = the
// tilemap write pointer), matching the hardware calling convention while still allowing an explicit call.
export function writePackedBcdWord(m, value = m.regs.de, ptr = m.regs.hl) {
  // ── High byte (thousands, hundreds) ─────────────────────────────────────────────────────
  // Shift the top eight bits down into a byte and print them as two digits at ptr. writePackedBcdByte
  // stamps the tens then the ones and hands back the pointer stepped up two 32-cell rows; capture that as
  // the write position for the low byte.
  const ptrAfterHighByte = writePackedBcdByte(m, value >> 8, ptr);

  // ── Low byte (tens, ones) ───────────────────────────────────────────────────────────────
  // Mask off the low eight bits and print them as the final two digits at the stepped-up pointer. Its
  // return — the pointer now four rows past where this word began — is our live-out HL for the caller.
  return writePackedBcdByte(m, value & 0xff, ptrAfterHighByte);
}
