// SPDX-License-Identifier: GPL-3.0-only
/**
 * replicateGroupStrided — copy ONE 4-byte source group into a run of strided destination slots.
 *
 * A struct-field initialiser, NOT a blitter. It takes a 4-byte template and stamps those SAME four
 * bytes into as many destination records as the caller asks for, each record a gap-plus-four bytes
 * after the previous one — so it seeds a run of records with one common header or value. The
 * source is re-read from the same place on every pass and never advances, so the last pass copies
 * exactly what the first one did. The gap size and the source pointer both survive the call
 * unchanged, which is what lets a caller run it twice by reloading only the destination and the
 * count.
 *
 * Destination addressing is 8-bit and confined to one page: the low half of the pointer is what
 * steps and what the gap is added to, so the page never changes and the offset WRAPS inside its
 * own 256 bytes. A 16-bit increment would silently turn that wrap into a page crossing, which is
 * this routine's standing hazard.
 *
 * DO NOT MERGE IT WITH ITS TWIN. A near-identical routine copies pairs rather than groups of four
 * and lets its source advance cumulatively instead of re-reading it, so it walks a run of
 * consecutive source bytes. The two look mergeable and are not.
 *
 * LIVE-OUT: memory — one copy of the group per record — plus the advanced in-page destination
 * offset, a duplicate of that offset, and the pass count run down to zero. The gap size, the
 * destination page and the source pointer are left exactly as they arrived.
 */
export function replicateGroupStrided(m) {
  const { regs, mem } = m;

  const src = regs.hl; // 4-byte source group; re-read every pass (never advances)
  const stride = regs.c; // extra spacing after each 4-byte copy (record size = stride + 4)
  const page = regs.d << 8; // the destination page, never modified
  // The pass count is decremented before it is tested, so zero means 256 passes rather than none.
  const groups = regs.b === 0 ? 256 : regs.b;

  let e = regs.e; // the in-page destination offset; 8-bit, wraps inside the page
  for (let g = 0; g < groups; g++) {
    for (let i = 0; i < 4; i++) {
      mem.write8(page | e, mem.read8((src + i) & 0xffff));
      e = (e + 1) & 0xff; // in-page step: never leaks into the next page
    }
    e = (e + stride) & 0xff; // step past the gap to the next record
  }

  // What the caller gets back. The gap size, destination page and source pointer are preserved.
  regs.e = e;
  regs.a = e; // a duplicate of the final in-page offset
  regs.b = 0; // both counted loops ran to zero
}
