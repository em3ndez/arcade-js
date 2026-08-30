// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * loc_0010 — fill a run of bytes with a constant, advancing the pointer as it goes.
 * ROM 0x0010. Grounding: [seen].
 *
 * This is the machine's memset primitive, and it lives at the Z80 restart vector 0x10 so any
 * caller can reach it with a single one-byte instruction. It writes the same fill value into
 * `count` consecutive bytes starting at the given address — used all over the engine to blank
 * RAM blocks, clear an actor record, or paint a run of identical VRAM tiles (see the row-fill
 * at ROM 0x02ce, the board reset at ROM 0x2527, and the record clear at ROM 0x28ad).
 *
 * The count comes in as an 8-bit loop counter, and the loop is decrement-then-test: a counter
 * of 0 does NOT fill zero bytes, it wraps around to a full 256. That is the natural behaviour of
 * the Z80 djnz instruction this routine is built on, and callers that want 256 bytes deliberately
 * pass 0.
 *
 * A pure leaf: it reads nothing and calls nothing, only writes the target run.
 *
 * LIVE-OUT: the filled run in memory, the pointer advanced to just past the last byte written
 * (start + count, 16-bit), and the counter drained to 0. Callers read both back — the pointer to
 * continue a longer fill, and the guaranteed-zero counter as a cleared value.
 */
export function loc_0010(m, start = m.regs.hl, fill = m.regs.a, len = m.regs.b) {
  const { mem8 } = m;

  // Decrement-then-test counter: 0 on entry means a full 256-byte fill, not an empty one.
  const count = len === 0 ? 256 : len;

  // Walk the run writing the fill value into each byte, advancing the pointer with 16-bit wrap
  // so a fill that crosses 0xffff continues at 0x0000 exactly as the hardware pointer would.
  let cell = start;
  for (let i = 0; i < count; i++) {
    mem8[cell] = fill;
    cell = u16(cell + 1);
  }

  // Leave the drained counter (always 0) and the advanced pointer where callers read them back.
  return (m.regs.b = 0), (m.regs.hl = cell);
}
