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

export function renderBonusDisplay(m, a = m.regs.a) {
  const { mem8 } = m;

  const digitByte = a;
  const unitsDigit = digitByte & 0x0f;
  const tensDigit = (digitByte >> 4) & 0x0f;

  if (tensDigit !== 0) {
    stampTwoDigitField(m, tensDigit, unitsDigit);
    return;
  }

  mem8[SND_BGM] = 0x03;
  mem8[0x7486] = 0x70;
  mem8[0x74a6] = 0x70;

  stampTwoDigitField(m, 0x10, 0x70 + unitsDigit);
}
