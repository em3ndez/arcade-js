// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyBytePairsStrided — scatter a run of consecutive source byte-pairs into strided records.
 *
 * A memory-init primitive. It walks a CONTIGUOUS source and lays its bytes down two per pass, into
 * a destination array whose records are spaced apart:
 *
 *   - Each pass reads two adjacent source bytes and stores them at offsets +0 and +2 of the
 *     current destination record. Offset +1 is NEVER written; the destination pointer steps twice
 *     between the two stores, straight past it.
 *   - The source advances CUMULATIVELY, two bytes per pass, so over the whole run it consumes two
 *     bytes per record. It is a full 16-bit advance, so the source MAY cross a page boundary.
 *   - The destination advances by the caller's gap plus 2 per pass. That advance touches the low
 *     byte only — the page is never modified — so the destination WRAPS inside its own 256 bytes
 *     and can never carry out of the page.
 *
 * DO NOT FOLD IT INTO ITS TWIN. A near-identical routine copies groups of four and re-reads the
 * SAME source group on every pass, which makes it a broadcast; this one lets the source walk
 * forward, which makes it a scatter. Near-identical code, opposite meaning.
 *
 * Everything arrives in registers: the source pointer, the destination, the pass count, and the
 * per-pass gap beyond the fixed +2. A pass count of zero means 256 passes, not none.
 *
 * A LEAF: it calls nothing.
 *
 * LIVE-OUT: memory-only — two destination bytes per pass.
 */
export function copyBytePairsStrided(m) {
  const { regs, mem } = m;

  let src = regs.hl; // source pointer; a full 16-bit advance, so it may cross a page
  const page = regs.de & 0xff00; // destination page — never changes
  let lo = regs.de & 0xff; // destination low byte — 8-bit, wraps within the page
  const stride = regs.c; // extra low-byte advance beyond the fixed +2 (net record stride = +2)
  // The pass count is decremented before it is tested, so zero means 256 passes rather than none.
  const passes = regs.b === 0 ? 256 : regs.b;

  for (let i = 0; i < passes; i++) {
    // First source byte -> record offset +0.
    mem.write8(page | lo, mem.read8(src));
    src = (src + 1) & 0xffff;

    // Step twice, straight past offset +1, so the next store lands at +2. Low byte only, so no
    // carry into the page.
    lo = (lo + 2) & 0xff;

    // Second source byte -> record offset +2.
    mem.write8(page | lo, mem.read8(src));
    src = (src + 1) & 0xffff;

    // Advance the low byte by the caller's gap, 8-bit. The net record stride is that gap plus 2,
    // and the page is untouched, so the destination stays inside it.
    lo = (lo + stride) & 0xff;
  }
}
