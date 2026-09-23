// SPDX-License-Identifier: GPL-3.0-only
/** sweepObjectSlotBankServicingFirstSlot — sweep a fixed bank of object slots for one frame from the seated cursors. Each slot's
 * marker routes it: empty is skipped, the ballistic marker flies the object a step, any other marker
 * services its shape-cycle. Cursors stride one record and one sprite entry per slot; the seated count
 * bounds the pass, and the first slot is always serviced. LIVE-OUT: memory only. */

import { u16 } from "../../../core/int.js";
import { runOneShotAnimatedObjectSlot } from "./runOneShotAnimatedObjectSlot.js";
import { flyAlongBallisticArc } from "./flyAlongBallisticArc.js";

const RECORD_STRIDE = 0x10;
const SPRITE_STRIDE = 2;
const EMPTY = 0x00;
const BALLISTIC = 0xff;

export function sweepObjectSlotBankServicingFirstSlot(m, record = m.regs.ix, sprite = m.regs.iy, count = m.regs.b) {
  const { mem8 } = m;
  let service = true;
  for (;;) {
    if (service) runOneShotAnimatedObjectSlot(m, record, sprite);

    record = u16(record + RECORD_STRIDE);
    sprite = u16(sprite + SPRITE_STRIDE);
    count = (count - 1) & 0xff;
    if (count === 0) return (m.regs.ix = record, m.regs.iy = sprite, m.regs.b = count, undefined);

    const marker = mem8[record];
    if (marker === EMPTY) { service = false; continue; }
    if (marker !== BALLISTIC) { service = true; continue; }
    flyAlongBallisticArc(m, record, sprite);
    service = false;
  }
}
