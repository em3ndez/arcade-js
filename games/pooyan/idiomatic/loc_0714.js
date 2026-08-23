// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
/**
 * loc_0714 — sprite-attribute copy loop.
 *
 * Runs `count` passes. Each pass reads four source bytes, walking the source low byte so it
 * wraps inside its 256-byte page: the first pair lands in the attribute area at attr+1 then
 * attr+0, the next pair at the position cursor then cursor+1. Both cursors advance by two.
 *
 * LIVE-OUT: A (the last byte copied — a caller reads it straight back), plus the advanced
 * position and attribute cursors (a caller threads both across successive copies). The source
 * is reloaded by the caller each call, so it is not live-out; `count` drains unread. Dispatched
 * register-wise from the frozen layer, so the outputs ride the return.
 */
export function loc_0714(m, src = m.regs.hl, attrCursor = m.regs.ix, posCursor = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;
  const page = src - (src & 0xff); // source high byte; the walk wraps within it
  let lo = src & 0xff;
  let attr = u16(attrCursor);
  let pos = u16(posCursor);
  let byte;
  let n = count;
  do {
    byte = mem8[page + lo]; mem8[u16(attr + 1)] = byte; // -> attr+1
    lo = u8(lo + 1);
    byte = mem8[page + lo]; mem8[attr] = byte; // -> attr+0
    lo = u8(lo + 1);
    byte = mem8[page + lo]; mem8[pos] = byte; pos = u16(pos + 1);
    lo = u8(lo + 1);
    byte = mem8[page + lo]; mem8[pos] = byte; pos = u16(pos + 1);
    lo = u8(lo + 1);
    attr = u16(attr + 2); // two attribute-cursor bumps per pass
    n = u8(n - 1);
  } while (n !== 0);
  return [(m.regs.a = byte), (m.regs.de = pos), (m.regs.ix = attr)];
}
