// SPDX-License-Identifier: GPL-3.0-only
/** advanceSlotThenSweepObjectBankByHead — enter the object-bank sweep at its advance step: stride one slot forward, and when the
 * count runs out return. An empty slot is stepped over, a ballistic (0xFF) slot is flown a frame and
 * stepped over, and the first slot carrying any other marker hands the rest of the bank to the
 * servicing sweep. Cursors stride one record and one sprite entry per slot. LIVE-OUT: memory. */

import { u16 } from "../../../core/int.js";
import { sweepObjectSlotBankServicingFirstSlot } from "./sweepObjectSlotBankServicingFirstSlot.js";
import { flyAlongBallisticArc } from "./flyAlongBallisticArc.js";

const RECORD_STRIDE = 0x10;
const SPRITE_STRIDE = 2;
const EMPTY = 0x00;
const BALLISTIC = 0xff;

export function advanceSlotThenSweepObjectBankByHead(m, record = m.regs.ix, sprite = m.regs.iy, count = m.regs.b) {
  const { mem8 } = m;
  for (;;) {
    record = u16(record + RECORD_STRIDE);
    sprite = u16(sprite + SPRITE_STRIDE);
    count = (count - 1) & 0xff;
    if (count === 0) return (m.regs.ix = record, m.regs.iy = sprite, m.regs.b = count, undefined);

    const marker = mem8[record];
    if (marker === EMPTY) continue;
    if (marker !== BALLISTIC) return (m.regs.ix = record, m.regs.iy = sprite, m.regs.b = count, sweepObjectSlotBankServicingFirstSlot(m));
    flyAlongBallisticArc(m, record, sprite);
  }
}
