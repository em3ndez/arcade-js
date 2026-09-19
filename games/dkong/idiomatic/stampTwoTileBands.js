// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampTwoTileBands — from the tilemap row base in HL, lay tile 0xFD across four cells, step over
 * a 28-cell gap, then lay tile 0xFC across four more — eight writes, ending 36 cells past the
 * base. Straight-line; the only input is the base pointer.
 *
 * LIVE-OUT: memory-only — the eight tilemap cells.
 */

import { u16 } from "../../../core/int.js";

export function stampTwoTileBands(m, hl = m.regs.hl) {
  const { mem8 } = m;

  let addr = hl;

  for (let i = 0; i < 4; i++) {
    mem8[addr] = 0xfd;
    addr = u16(addr + 1);
  }

  addr = u16(addr + 0x1c);

  for (let i = 0; i < 4; i++) {
    mem8[addr] = 0xfc;
    addr = u16(addr + 1);
  }
}
