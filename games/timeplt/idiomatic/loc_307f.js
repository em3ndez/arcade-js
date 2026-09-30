// SPDX-License-Identifier: GPL-3.0-only
/** loc_307f — tail of a per-slot sprite-entry fill: store a coordinate through the pointer and fold
 * it into the byte handed in, then hand the slot to the straight placer while the counter holds. On
 * the last slot the original indexes a word table by the fold, bumps the byte past the entry, and then
 * pops two stack bytes it never pushed, dropping its caller's return word so control unwinds a level
 * out of step. This layer lays no return words, so that unwind has no faithful transcription and the
 * arm raises at the pop. It is never taken: the one way in (the scenery seed's guard-fail divert) always
 * arrives with the clear loop's spent count of zero, which counts down to 255, the straight placer.
 * LIVE-OUT: memory, and the placer's cursors. */

import { placeTileAtTableSuppliedOffset } from "./placeTileAtTableSuppliedOffset.js";
import { u8, u16 } from "../../../core/int.js";
import { NotImplemented } from "../../../boards/timeplt/io.js";

export function loc_307f(m, hl = m.regs.hl, e = m.regs.e, a = m.regs.a, b = m.regs.b, iy = m.regs.iy, c = m.regs.c) {
  const { mem8 } = m;
  mem8[hl] = e;
  const fold = a & mem8[hl];

  // DJNZ: decrement the slot counter (8-bit wrap). While it still holds, the slot goes to the straight
  // placer with the decremented counter; the fold's flags are dead there (the placer's add rewrites them).
  const counter = (b - 1) & 0xff;
  if (counter !== 0) return placeTileAtTableSuppliedOffset(m, iy, hl, c, counter);

  // Last slot: the word table indexed by the fold leaves its pointer one entry on (the entry start,
  // stepped by the doubled index, advanced two), and the byte there is bumped. Then the pop.
  const entryTail = u16(hl + u8(fold + fold) + 2);
  mem8[entryTail] = mem8[entryTail] + 1;
  throw new NotImplemented(
    "loc_307f: the last slot pops a return word nobody pushed and unwinds its caller out of step; " +
      "the only way in arrives with a spent count and never takes this arm",
  );
}
