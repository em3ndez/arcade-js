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
export function copyBytePairsStrided(m) {
  const { regs, mem8 } = m;

  let src = regs.hl;
  const page = regs.de & 0xff00;
  let lo = regs.de & 0xff;
  const stride = regs.c; // extra low-byte advance beyond the fixed +2
  const passes = regs.b === 0 ? 256 : regs.b;

  for (let i = 0; i < passes; i++) {
    mem8[page | lo] = mem8[src];
    src = (src + 1) & 0xffff;

    lo = (lo + 2) & 0xff; // step past offset +1, low byte only

    mem8[page | lo] = mem8[src];
    src = (src + 1) & 0xffff;

    lo = (lo + stride) & 0xff;
  }
}
