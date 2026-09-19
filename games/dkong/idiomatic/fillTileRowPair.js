// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTileRowPair — stamp a fixed two-row motif into the background tilemap from the caller's
 * top-left cell (HL): 17 cells of tile 0xFD along a row, then 17 cells of tile 0xFC on the row
 * directly below. The 15-cell skip between runs is the rest of the 32-cell row width, so the
 * second run lands on the same column one row on.
 *
 * LIVE-OUT: memory-only — 34 tilemap cells, 17 of each tile.
 */
import { u16 } from "../../../core/int.js";

export function fillTileRowPair(m, hl = m.regs.hl) {
  const { mem8 } = m;

  let addr = hl;

  for (let i = 0; i < 0x11; i++) {
    mem8[addr] = 0xfd;
    addr = u16(addr + 1);
  }

  addr = u16(addr + 0x0f);

  for (let i = 0; i < 0x11; i++) {
    mem8[addr] = 0xfc;
    addr = u16(addr + 1);
  }
}
