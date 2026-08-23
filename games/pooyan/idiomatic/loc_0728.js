// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_0714 } from "./loc_0714.js";
/**
 * loc_0728 — tail of the sprite-attribute copy loop: step the record pointer and continue.
 *
 * Advances the record pointer a second time for the iteration and counts the iteration counter
 * down. While iterations remain it re-enters the copy body with the advanced pointers; when the
 * counter drains the loop is done.
 *
 * LIVE-OUT: the advanced record pointer (IX) and destination pointer (DE) — the caller chains its
 * next copy from them. The counter and source pointer are reloaded per call, not read back.
 */
export function loc_0728(m, src = m.regs.hl, rec = m.regs.ix, dst = m.regs.de, count = m.regs.b) {
  const nextRec = u16(rec + 1);
  const nextCount = u8(count - 1);
  if (nextCount !== 0) return loc_0714(m, src, nextRec, dst, nextCount); // more iterations
  return [(m.regs.ix = nextRec), (m.regs.de = dst)]; // loop done: IX/DE live-out
}
