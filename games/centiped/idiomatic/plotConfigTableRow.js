// SPDX-License-Identifier: GPL-3.0-only
import { readFdBitsTableByte } from "./readFdBitsTableByte.js";
import { plotByteAsTwoDigits } from "./plotByteAsTwoDigits.js";
import { writePointerTableRow } from "./writePointerTableRow.js";
import { plotNormalizedCharCode } from "./plotNormalizedCharCode.js";
import { CONFIG_DIP_BYTE, loc_ae, loc_b0, loc_21c0 } from "./names.js";

/**
 * plotConfigTableRow — draw a config-selected readout. The mode cell's two select bits index a pair of
 * adjacent byte tables; the first byte is stashed and printed as a digit pair, the second is plotted as
 * a glyph, and a trailing zero is printed too. A fixed layout row is laid first. [code]
 *
 * The digit printer exposes its exit carry, so the first print's carry feeds the tail zero-print. [code]
 */
export function plotConfigTableRow(m) {
  const { mem8 } = m;

  // Table index from the mode cell's two select bits (mirrors the lookup helper's own index).
  const idx = (mem8[CONFIG_DIP_BYTE] & 0x30) >> 3;
  mem8[loc_ae] = readFdBitsTableByte(m); // first table byte (also seats the shared index)
  mem8[loc_b0] = mem8[loc_21c0 + idx];   // adjacent parallel-table byte

  // Lay the layout row (selector 6); its exit carry seeds the glyph plot's mode, whose exit carry in
  // turn seeds the first digit-pair print. Print the first byte, then a trailing zero, as digit pairs.
  const rowCarry = writePointerTableRow(m, 0x06);
  const glyphCarry = plotNormalizedCharCode(m, mem8[loc_b0], rowCarry);
  plotByteAsTwoDigits(m, mem8[loc_ae], glyphCarry);
  return plotByteAsTwoDigits(m, 0);
}
