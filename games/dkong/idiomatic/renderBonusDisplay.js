// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderBonusDisplay — render a packed two-digit BCD byte into its on-screen field, suppressing
 * a leading zero.
 *
 * The incoming byte holds two BCD digits, one per nibble: the low nibble is the units digit,
 * the high nibble the tens digit. The routine turns the two digits into their tiles and hands
 * them to a shared two-cell stamp, which places the tens tile in the high field cell and the
 * units tile in the low field cell one column earlier.
 *
 *   - Tens digit NON-ZERO: stamp both digit tiles as-is.
 *   - Tens digit ZERO: suppress the leading digit. The high cell gets a blank tile instead of
 *     a "0", and the units digit is shifted into a second tile row before being stamped. This
 *     arm additionally latches a background-music command and paints a fixed tile into two
 *     more field cells — the extra furniture that goes with a suppressed leading digit.
 *
 * The digit byte arrives in a register from the task that maintains the bonus readout, so this
 * is the routine that puts that readout on screen.
 *
 * WHAT THIS DOES NOT CLAIM: not that the routine changes the bonus — it only SHOWS it, and
 * writes no work RAM at all beyond the music latch. Nor is the field's screen position
 * pixel-verified; "on-screen field" rests on the video-RAM addresses it writes.
 *
 * LIVE-OUT: memory-only — the music latch plus the field's video cells.
 */

import { SND_BGM } from "./names.js";
import { stampTwoDigitField } from "./stampTwoDigitField.js";

export function renderBonusDisplay(m) {
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
  mem.write8(0x7486, 0x70); // video RAM — field cell, fixed tile
  mem.write8(0x74a6, 0x70); // video RAM — field cell, fixed tile

  regs.a = 0x10;                 // blank tile for the suppressed leading digit
  regs.b = 0x70 + unitsDigit;    // units digit shifted into the second tile row
  stampTwoDigitField(m);
}
