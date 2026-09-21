// SPDX-License-Identifier: GPL-3.0-only
/**
 * replicateGroupStrided — stamp ONE 4-byte source group into a run of strided destination
 * records. The source is re-read each pass (never advances); destination addressing is 8-bit and
 * wraps inside one page. Not to be merged with its pair-copying twin, whose source advances
 * cumulatively.
 *
 * LIVE-OUT: memory — one copy of the group per record — plus the advanced in-page offset, its
 * duplicate in A, and the pass count run to zero. Gap size, destination page and source pointer
 * are preserved.
 */
import { u16 } from "../../../core/int.js";

export function replicateGroupStrided(m, src = m.regs.hl, stride = m.regs.c, page = m.regs.d << 8, b = m.regs.b, e = m.regs.e) {
  const { regs, mem8 } = m;

  const groups = b === 0 ? 256 : b; // count decremented before test: 0 means 256

  for (let g = 0; g < groups; g++) {
    for (let i = 0; i < 4; i++) {
      mem8[page | e] = mem8[u16(src + i)];
      e = (e + 1) & 0xff; // in-page step; never leaks into the next page
    }
    e = (e + stride) & 0xff;
  }

  return [regs.e = e, regs.a = e, regs.b = 0];
}
