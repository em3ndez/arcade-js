// SPDX-License-Identifier: GPL-3.0-only
import { readFdBitsTableByte } from "./readFdBitsTableByte.js";
import { plotByteAsTwoDigits } from "./plotByteAsTwoDigits.js";
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

  // Lay the layout row (selector 6), then plot the parallel byte as a glyph.
  m.regs.a = 0x06; m.push16(0x21a3); m.call(0x37d5);
  m.regs.a = mem8[loc_b0]; m.push16(0x21a8); m.call(0x385c);
  // Print the first byte, then a trailing zero, as digit pairs. The first print's carry-in is m.regs.fC
  // from the kept glyph plot above; its exit carry rides back into m.regs.fC via the printer's return.
  plotByteAsTwoDigits(m, mem8[loc_ae], m.regs.fC);
  // Tail zero-print: carry defaults from m.regs.fC, which the first-print's return-assignment above set.
  return plotByteAsTwoDigits(m, 0);
}
