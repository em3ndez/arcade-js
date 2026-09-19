// SPDX-License-Identifier: GPL-3.0-only
/**
 * tileAddrForPixel — map a screen pixel (y, x) to its tilemap cell address (a pure leaf):
 *   col = (x >> 3) & 0x1f;  row = (255 - y) >> 3;  address = VRAM base + row*32 + col.
 * ⚠ y is COMPLEMENTED before the divide, so the game addresses its tilemap vertically MIRRORED —
 * the 180° render flip reproduces a transform the game already assumes, it is not imposed on top.
 * row is 31 at most, so row*32 stays under 0x400 and the final add never wraps. LIVE-OUT: the address.
 */
import { TILEMAP_BASE } from "./names.js";

export function tileAddrForPixel(y, x) {
  const col = (x >> 3) & 0x1f;
  const row = ((~y) & 0xff) >> 3;
  return (TILEMAP_BASE + row * 32 + col) & 0xffff;
}

/**
 * tileAddrForPixelFromRegisters — the seam entry: marshals the machine to the pure (y, x) and
 * replays its register/flag return. It reproduces the row-base pair (not just the address) because
 * not all callers bracket the call in a push/pop — one lets that pair flow on to its own caller.
 */
export function tileAddrForPixelFromRegisters(m, y = m.regs.h, x = m.regs.l) {
  const { regs } = m;

  const rowBase = tileAddrForPixel(y, 0); // the pure function at column zero

  regs.hl = (x >> 3) & 0x1f;
  regs.e = rowBase & 0xff;
  regs.a = (rowBase >> 8) - 0x74;
  regs.add(0x74); // page add — also sets the flags
  regs.d = regs.a;
  regs.addHl(regs.de);
}
