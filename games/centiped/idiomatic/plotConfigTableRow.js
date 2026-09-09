// SPDX-License-Identifier: GPL-3.0-only
import { readFdBitsTableByte } from "./readFdBitsTableByte.js";
import { plotByteAsTwoDigits } from "./plotByteAsTwoDigits.js";
import { writePointerTableRow } from "./writePointerTableRow.js";
import { plotNormalizedCharCode } from "./plotNormalizedCharCode.js";
import { CONFIG_DIP_BYTE, loc_ae, loc_b0, loc_21c0 } from "./names.js";

/**
 * plotConfigTableRow — draw one config-selected readout line onto the screen.
 *
 * Role in the machine: the operator's option DIP settings choose which of several parallel ROM
 * value tables the machine reads its per-config numbers from. This routine renders one such line:
 * bits 5-4 of the mode/config cell `CONFIG_DIP_BYTE` (0x00fd, [seen]) pick a variant, and that
 * variant indexes a PAIR of adjacent ROM byte tables. The first table's byte is stashed and printed
 * as a two-digit number; the second (parallel) table's byte is printed as a single glyph; and a
 * trailing zero digit-pair closes the line. A fixed layout row (the label/scaffolding) is drawn
 * first so the numbers land in the right place. [code]
 *
 * Carry threading: the digit/glyph printers expose their exit carry, so leading-zero suppression
 * flows in one continuous chain — layout row -> glyph -> first number -> trailing zero. [code]
 *
 * Grounding: [code] overall; `CONFIG_DIP_BYTE` is [seen], and `loc_21c0` is a batch-2 placeholder
 * for the adjacent ROM value table ([code]).
 *
 * Live-out: returns the trailing digit-pair's exit carry (dead at the caller); the visible effect is
 * the drawn line plus the stash of both source bytes into `loc_ae`/`loc_b0`.
 */
export function plotConfigTableRow(m) {
  const { mem8 } = m;

  // Derive the parallel-table index the same way the lookup helper does: mode/config bits 5-4 of
  // CONFIG_DIP_BYTE, shifted down to an even index (0/2/4/6) so it steps whole entries in the pair
  // of byte tables.
  const idx = (mem8[CONFIG_DIP_BYTE] & 0x30) >> 3;
  mem8[loc_ae] = readFdBitsTableByte(m); // first table byte (also seats the shared index)
  mem8[loc_b0] = mem8[loc_21c0 + idx];   // adjacent parallel-table byte

  // Lay the fixed layout row first (selector 6 into the ROM row-descriptor table); it returns an
  // exit carry that seeds the glyph plot's mode, whose exit carry in turn seeds the first digit-pair
  // print -- so leading-zero state flows across the whole line. Print the first table byte as a
  // two-digit number, then a trailing zero as a digit pair to close the field.
  const rowCarry = writePointerTableRow(m, 0x06);
  const glyphCarry = plotNormalizedCharCode(m, mem8[loc_b0], rowCarry);
  plotByteAsTwoDigits(m, mem8[loc_ae], glyphCarry);
  return plotByteAsTwoDigits(m, 0);
}
