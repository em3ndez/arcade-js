// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyBytePairsStrided — scatter a contiguous source into strided destination records. Each pass
 * reads two adjacent source bytes and stores them at offsets +0 and +2 of the current record
 * (offset +1 is never written); the source advances cumulatively (full 16-bit), the destination
 * by the caller's gap plus 2 (low byte only, so it wraps inside its page). Pass count 0 means 256.
 *
 * A near-identical twin copies groups of four and re-reads the same source group each pass (a
 * broadcast); this one walks the source forward (a scatter). Do not fold them together.
 *
 * LIVE-OUT: memory-only — two destination bytes per pass.
 */
import { u16, page } from "../../../core/int.js";

export function copyBytePairsStrided(m, src = m.regs.hl, de = m.regs.de, stride = m.regs.c, b = m.regs.b) {
  const { mem8 } = m;

  const pg = page(de);
  let lo = de & 0xff;
  const passes = b === 0 ? 256 : b;

  for (let i = 0; i < passes; i++) {
    mem8[pg | lo] = mem8[src];
    src = u16(src + 1);

    lo = (lo + 2) & 0xff; // step past offset +1, low byte only

    mem8[pg | lo] = mem8[src];
    src = u16(src + 1);

    lo = (lo + stride) & 0xff;
  }
}
