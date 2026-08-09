// SPDX-License-Identifier: GPL-3.0-only
/** loc_4008 — sweep a fixed bank of object slots for one frame from the seated cursors. Each slot's
 * marker routes it: empty is skipped, the ballistic marker flies the object a step, any other marker
 * services its shape-cycle. Cursors stride one record and one sprite entry per slot; the seated count
 * bounds the pass, and the first slot is always serviced. LIVE-OUT: memory only. */

import { runOneShotAnimatedObjectSlot } from "./runOneShotAnimatedObjectSlot.js";
import { flyAlongBallisticArc } from "./flyAlongBallisticArc.js";

const RECORD_STRIDE = 0x10;
const SPRITE_STRIDE = 2;
const EMPTY = 0x00;
const BALLISTIC = 0xff;

export function loc_4008(m) {
  const { regs, mem8 } = m;
  let service = true;
  for (;;) {
    if (service) runOneShotAnimatedObjectSlot(m);

    regs.ix = (regs.ix + RECORD_STRIDE) & 0xffff;
    regs.iy = (regs.iy + SPRITE_STRIDE) & 0xffff;
    regs.b = (regs.b - 1) & 0xff;
    if (regs.b === 0) return;

    const marker = mem8[regs.ix];
    if (marker === EMPTY) { service = false; continue; }
    if (marker !== BALLISTIC) { service = true; continue; }
    flyAlongBallisticArc(m);
    service = false;
  }
}
