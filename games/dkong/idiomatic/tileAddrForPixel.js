// SPDX-License-Identifier: GPL-3.0-only
/**
 * tileAddrForPixel — map a screen pixel (y, x) to its tilemap cell address (a pure leaf):
 *   col = (x >> 3) & 0x1f;  row = (255 - y) >> 3;  address = VRAM base + row*32 + col.
 * ⚠ y is COMPLEMENTED before the divide, so the game addresses its tilemap vertically MIRRORED —
 * the 180° render flip reproduces a transform the game already assumes, it is not imposed on top.
 * row is 31 at most, so row*32 stays under 0x400 and the final add never wraps. LIVE-OUT: the address.
 */
import { u16 } from "../../../core/int.js";
import { TILEMAP_BASE } from "./names.js";

export function tileAddrForPixel(y, x) {
  const col = (x >> 3) & 0x1f;
  const row = ((~y) & 0xff) >> 3;
  return u16(TILEMAP_BASE + row * 32 + col);
}

/**
 * tileAddrForPixelFromRegisters — the seam entry: marshals the machine to the pure (y, x) and
 * replays its register return. It reproduces the row-base pair (D/E = rowBase, not just the
 * address) because not all callers bracket the call in a push/pop — one lets that pair flow on
 * to its own caller. The page-add flag byte is dead at every caller and is not reproduced.
 */
export function tileAddrForPixelFromRegisters(m, y = m.regs.h, x = m.regs.l) {
  const rowBase = tileAddrForPixel(y, 0); // the pure function at column zero
  const col = (x >> 3) & 0x1f;

  const eVal = rowBase & 0xff;
  const aVal = (rowBase >> 8) & 0xff;
  const dVal = aVal;
  const hlVal = u16(col + rowBase); // DE = rowBase, so col + rowBase is the addHl result

  // outgoing seam ABI: set the frozen dispatch's registers AND return the address
  return (m.regs.a = aVal, m.regs.d = dVal, m.regs.e = eVal, m.regs.hl = hlVal);
}
