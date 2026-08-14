// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0695 — stamp a 2-by-2 marker block at the base cell a caller passes in a register.
 * Writes the marker tile into four cells: the base, the next cell, and the two one row below.
 * LIVE-OUT: memory-only.
 */
const MARKER_TILE = 16;
const ROW = 32;

export function loc_0695(m, base = m.regs.hl) {
  const { mem8 } = m;
  mem8[base] = MARKER_TILE;
  mem8[(base + 1) & 0xffff] = MARKER_TILE;
  mem8[(base + ROW) & 0xffff] = MARKER_TILE;
  mem8[(base + ROW + 1) & 0xffff] = MARKER_TILE;
}
