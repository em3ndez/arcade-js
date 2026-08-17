// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeSpriteObjectSlotX — IX sprite-object arm. When active ((IX+6)!=0), read the 0x80-page table byte indexed by
 * (IX+0x0b) and store (byte - (IX+2)) to (IY+0) and (IX+4) to (IY+3). IX/IY live-in. LIVE-OUT: memory-only.
 */
import { loc_8000 } from "./names.js";

export function writeSpriteObjectSlotX(m, obj = m.regs.ix, spr = m.regs.iy) {
  const { mem8 } = m;

  if (mem8[(obj + 0x06)] === 0) return; // inactive object

  const tableByte = mem8[loc_8000 | mem8[(obj + 0x0b)]];
  mem8[(spr + 0x00)] = (tableByte - mem8[(obj + 0x02)]) & 0xff;
  mem8[(spr + 0x03)] = mem8[(obj + 0x04)];
}
