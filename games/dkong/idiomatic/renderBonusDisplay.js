// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderBonusDisplay — render a packed two-digit BCD byte (high nibble tens, low nibble units)
 * into its on-screen field, suppressing a leading zero. On the suppressed arm it also latches a
 * background-music command, paints two fixed field tiles, and shifts the units digit a tile row.
 *
 * LIVE-OUT: memory-only — the music shadow plus the field's video cells.
 */

import { SND_BGM } from "./names.js";
import { stampTwoDigitField } from "./stampTwoDigitField.js";

export function renderBonusDisplay(m) {
  const { regs, mem8 } = m;

  const digitByte = regs.a;
  const unitsDigit = digitByte & 0x0f;
  const tensDigit = (digitByte >> 4) & 0x0f;

  if (tensDigit !== 0) {
    regs.a = tensDigit;
    regs.b = unitsDigit;
    stampTwoDigitField(m);
    return;
  }

  mem8[SND_BGM] = 0x03;
  mem8[0x7486] = 0x70;
  mem8[0x74a6] = 0x70;

  regs.a = 0x10;                 // blank tile for the suppressed leading digit
  regs.b = 0x70 + unitsDigit;    // units digit shifted into the second tile row
  stampTwoDigitField(m);
}
