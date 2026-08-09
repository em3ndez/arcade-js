// SPDX-License-Identifier: GPL-3.0-only
/** loc_400b — enter the object-bank sweep at its advance step: stride one slot forward, and when the
 * count runs out return. An empty slot is stepped over, a ballistic (0xFF) slot is flown a frame and
 * stepped over, and the first slot carrying any other marker hands the rest of the bank to the
 * servicing sweep. Cursors stride one record and one sprite entry per slot. LIVE-OUT: memory. */

import { sweepObjectSlotBankServicingFirstSlot } from "./sweepObjectSlotBankServicingFirstSlot.js";
import { flyAlongBallisticArc } from "./flyAlongBallisticArc.js";

const RECORD_STRIDE = 0x10;
const SPRITE_STRIDE = 2;
const EMPTY = 0x00;
const BALLISTIC = 0xff;

export function loc_400b(m) {
  const { regs, mem8 } = m;
  for (;;) {
    regs.ix = (regs.ix + RECORD_STRIDE) & 0xffff;
    regs.iy = (regs.iy + SPRITE_STRIDE) & 0xffff;
    regs.b = (regs.b - 1) & 0xff;
    if (regs.b === 0) return;

    const marker = mem8[regs.ix];
    if (marker === EMPTY) continue;
    if (marker !== BALLISTIC) return sweepObjectSlotBankServicingFirstSlot(m);
    flyAlongBallisticArc(m);
  }
}
