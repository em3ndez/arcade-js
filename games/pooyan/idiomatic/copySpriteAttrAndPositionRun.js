// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
/**
 * copySpriteAttrAndPositionRun — the scroll-column rebuild loop: fan four source bytes per pass into the sprite
 * attribute area and the position cursor. [seen] · ROM 0x0714–0x0727.
 *
 * Each per-frame heartbeat (the vblank NMI service runVblankNmiService, ROM 0x066d) rebuilds the sprite
 * scroll columns by driving this loop. One pass consumes four consecutive source bytes and
 * scatters them into two destinations:
 *   - the ATTRIBUTE AREA, as a swapped pair: the first byte goes to attr+1, the second to
 *     attr+0. (Hardware stores these two attribute bytes in the opposite order to the source,
 *     so the loop writes the high slot first.)
 *   - the POSITION CURSOR, as a straight pair: the third byte to pos+0, the fourth to pos+1,
 *     the cursor advancing one cell after each write.
 * After the four writes the attribute cursor advances by two (one attribute pair consumed),
 * and the pass count is decremented.
 *
 * The source pointer is walked by its LOW BYTE only, wrapping inside its own 256-byte page:
 * the source table is page-aligned, so the high byte is fixed and the read never escapes the
 * page even as the low byte rolls over.
 *
 * The count is tested AFTER each pass (a do-while): the body always runs at least once, and a
 * count of 0 on entry would run a full 256 passes. Callers always pass a real count.
 *
 * LIVE-OUT:
 *   - the last byte copied — a caller reads it straight back;
 *   - the advanced position cursor and the advanced attribute cursor — a caller threads both
 *     across successive copies to continue the column.
 * The source is reloaded by the caller each call, so it is not live-out; the count drains to 0
 * and is unread.
 */
export function copySpriteAttrAndPositionRun(m, src = m.regs.hl, attrCursor = m.regs.ix, posCursor = m.regs.de, count = m.regs.b) {
  const { mem8 } = m;

  // Split the source into its fixed page and a rolling low byte: the table is page-aligned,
  // so all reads land at page+lo and the low byte wraps within the 256-byte page.
  const page = src - (src & 0xff);
  let lo = src & 0xff;

  let attr = u16(attrCursor);
  let pos = u16(posCursor);
  let byte;
  let n = count;

  do {
    // First source byte → attr+1 (the high attribute slot; the pair is written swapped).
    byte = mem8[page + lo]; mem8[u16(attr + 1)] = byte;
    lo = u8(lo + 1);

    // Second source byte → attr+0 (the low attribute slot).
    byte = mem8[page + lo]; mem8[attr] = byte;
    lo = u8(lo + 1);

    // Third and fourth source bytes → the position cursor, straight order, cursor++ each.
    byte = mem8[page + lo]; mem8[pos] = byte; pos = u16(pos + 1);
    lo = u8(lo + 1);
    byte = mem8[page + lo]; mem8[pos] = byte; pos = u16(pos + 1);
    lo = u8(lo + 1);

    // One attribute pair consumed this pass — step the attribute cursor by two.
    attr = u16(attr + 2);

    n = u8(n - 1);
  } while (n !== 0);

  // Hand back the last byte copied and both advanced cursors so the caller can continue.
  return [(m.regs.a = byte), (m.regs.de = pos), (m.regs.ix = attr)];
}
