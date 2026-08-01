// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_066a — render a packed two-digit BCD byte into its on-screen field, suppressing a
 * leading zero.  ROM 0x066A.
 *
 * The incoming byte holds two BCD digits, one per nibble: the low nibble is the units
 * digit, the high nibble the tens digit. The routine turns the two digits into their tiles
 * and hands them to the shared stamp tail (stampTwoDigitField), which places the tens tile
 * in the high field cell and the units tile in the low field cell one column earlier.
 *
 *   - Tens digit NON-ZERO: stamp both digit tiles as-is (tens into the high cell, units
 *     into the low cell).
 *   - Tens digit ZERO: suppress the leading digit. The high cell gets a blank tile (0x10)
 *     instead of a "0", and the units digit is shifted into the 0x70-based tile row
 *     (0x70 + units) before being stamped. This arm additionally latches the background
 *     music command (SND_BGM = 3) and paints a fixed 0x70 tile into two more field cells
 *     (0x7486, 0x74A6) — the extra furniture that goes with a suppressed leading digit.
 *
 * A JOIN reached by fallthrough and by a jump from the task that builds the two-digit
 * board readout; the digit byte arrives in a register from that caller.
 *
 * Memory-equivalent to the frozen oracle — equivalence-066a.test.js.
 * GATE:     exhaustive — the memory effect is a pure function of the incoming digit byte
 *           (the routine reads no work RAM), so sweeping all 256 byte values on a real
 *           captured base is a proof covering BOTH arms; attract only reaches the tens-nonzero
 *           arm, so the sweep is what covers the leading-zero-suppress arm. Backed by real
 *           captured 0x066A dispatches. Whole-RAM diff (neither side writes the stack — the
 *           oracle's tail only pops, so there is no dissolved push to exclude). Teeth: a
 *           dropped SND_BGM latch, a swapped digit pair, and a wrong units-tile offset.
 * LIVE-OUT: memory-only — SND_BGM plus the field's video cells. The digit byte arrives in a
 *           register (a still-translated caller marshals it — an oracle boundary), and no
 *           caller reads a register back, so the residual registers/flags are dead.
 * NAMES:    SND_BGM (0x6089) from ram.js. The field cells 0x7486/0x74A6 (and the tail's
 *           0x74E6/0x74C6) are video RAM, which ram.js does not name, so they stay hex.
 */

import { SND_BGM } from "./ram.js";
import { stampTwoDigitField } from "./stampTwoDigitField.js"; // ROM 0x0689 — the shared two-cell stamp tail

export function loc_066a(m) {
  const { regs, mem } = m;

  // Split the incoming packed byte into its two BCD digits.
  const digitByte = regs.a;
  const unitsDigit = digitByte & 0x0f;
  const tensDigit = (digitByte >> 4) & 0x0f;

  if (tensDigit !== 0) {
    // Leading digit present — stamp both digit tiles unchanged.
    regs.a = tensDigit;
    regs.b = unitsDigit;
    stampTwoDigitField(m);
    return;
  }

  // Leading digit is zero — suppress it. Latch the background-music command and paint the
  // two fixed field tiles, then stamp a blank high tile with the units digit shifted into
  // the 0x70 tile row.
  mem.write8(SND_BGM, 0x03);
  mem.write8(0x7486, 0x70); // video RAM — field cell, fixed 0x70 tile
  mem.write8(0x74a6, 0x70); // video RAM — field cell, fixed 0x70 tile

  regs.a = 0x10;                 // blank tile for the suppressed leading digit
  regs.b = 0x70 + unitsDigit;    // units digit shifted into the 0x70 tile row
  stampTwoDigitField(m);
}
