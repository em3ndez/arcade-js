// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { copySpriteAttrAndPositionRun } from "./copySpriteAttrAndPositionRun.js";
/**
 * loc_0728 — tail of the sprite-attribute copy loop: step the attribute cursor a second time,
 * then loop back to the copy body while passes remain.  [seen] · ROM 0x0728–0x072c.
 *
 * WHAT IT IS
 *   The closing instructions of the scroll-column / sprite-bank rebuild loop whose body is
 *   copySpriteAttrAndPositionRun (ROM 0x0714–0x0727). One pass of that body fans four source
 *   bytes into the sprite attribute area (IX) and the position cursor (DE) and steps the attribute
 *   cursor once; this tail steps the attribute cursor the second time and then decides whether
 *   another pass runs. Body plus tail together are one loop that spans the routine boundary.
 *
 * ROLE IN THE MACHINE
 *   The per-frame heartbeat runVblankNmiService (ROM 0x066d) rebuilds the two hardware sprite banks
 *   from the staged sprite display list by driving this loop — copying either a single 0x18-tall
 *   sprite group or, in in-play sub-state 4, four groups whose destination cursors are threaded
 *   across the successive copies so the groups land back-to-back. This routine is the per-pass
 *   hinge of that copy: it advances the cursors between passes and counts the passes down.
 *
 * REGISTERS
 *   HL (src)   — source read pointer for the copy body (page-aligned; the body walks it by low byte).
 *   IX (rec)   — the sprite-attribute cursor; advances by two per pass (once in the body, once here).
 *   DE (dst)   — the position cursor; the body advances it as it writes each coordinate pair.
 *   B  (count) — remaining-pass counter for the copy run.
 *
 * LIVE-OUT: the advanced attribute cursor (IX) and the position cursor (DE) — the caller chains its
 * next copy group from them. The pass counter drains to 0 and the source pointer is reloaded on the
 * next call, so neither is read back.
 */
export function loc_0728(m, src = m.regs.hl, rec = m.regs.ix, dst = m.regs.de, count = m.regs.b) {
  // ROM 0x0728 `inc ix`: the second step of the attribute cursor for this pass. The copy body has
  // already stepped it once after writing its attribute pair, so the two steps together advance IX
  // by two — past the pair just written, onto the next attribute slot for the following pass.
  const nextRec = u16(rec + 1);
  // ROM 0x072a `djnz`: decrement the remaining-pass counter (B). One pass of the copy body has just
  // finished, so one fewer pass remains in this run.
  const nextCount = u8(count - 1);
  // djnz taken (passes still remain): re-enter the copy body at ROM 0x0714 for the next pass,
  // carrying the twice-advanced attribute cursor and the position cursor (this tail leaves DE
  // untouched) plus the still-draining count; the source pointer is passed through unchanged.
  if (nextCount !== 0) return copySpriteAttrAndPositionRun(m, src, nextRec, dst, nextCount);
  // djnz not taken (counter drained): the run is done. Commit the final attribute cursor to IX and
  // the position cursor to DE as live-out (ROM 0x072c `ret`), so the heartbeat can chain the next
  // sprite-bank copy group from exactly where this one left off.
  return [(m.regs.ix = nextRec), (m.regs.de = dst)];
}
