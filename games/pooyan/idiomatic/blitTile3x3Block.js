// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * blitTile3x3Block — stamp a 3-wide, 3-tall tile block into video RAM.
 *
 * For each of three rows it copies three source bytes into consecutive destination cells,
 * then steps the destination down one screen row (3 written + 0x1d = 0x20 cells). Source and
 * destination pointers come from the caller. A leaf: writes only the nine cells, calls nothing.
 *
 * LIVE-OUT: the advanced destination pointer (dst + 0x60, 16-bit), returned — a caller stamps
 * the next cell through it. (The source also advances by nine, but no caller reads it.)
 */
export function blitTile3x3Block(m, dst = m.regs.hl, src = m.regs.de) {
  const { mem8 } = m;

  let cell = dst;
  let tile = src;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      mem8[cell] = mem8[tile];
      cell = u16(cell + 1);
      tile = u16(tile + 1);
    }
    cell = u16(cell + 0x1d); // step to the next screen row
  }

  return (m.regs.hl = u16(cell));
}
