// SPDX-License-Identifier: GPL-3.0-only
/**
 * gatherSpriteRecords — build a run of hardware sprite records by gathering four permuted fields
 * out of each object record.
 *
 * For each of a caller-supplied count of object records — the first at the source base, the next
 * one stride on, and so on — this reads four fixed field offsets and stores them into four
 * CONSECUTIVE destination bytes, laying down one 4-byte hardware sprite record per object. The
 * source offsets are +3, +7, +8, +5, IN THAT ORDER: a permuting gather, not a block copy (+5 is
 * read after +7/+8, and +4/+6 are never read at all). Against the sprite record's own byte layout
 * — X, sprite code, attribute, Y — the gather fills X from the object's +3, the code from +7, the
 * attribute from +8 and Y from +5. What those four object fields individually mean is described
 * from that pairing, not independently established.
 *
 * Everything is caller-supplied and nothing is initialised here: the record count, the destination
 * pointer, the source base and the per-record source stride all arrive in the machine's registers.
 *
 * The destination pointer advances in its low byte only, so it wraps within its 256-byte page
 * instead of running on into the next one. A count of zero means 256 records, not none.
 *
 * LIVE-OUT: memory — four bytes per record at the destination — plus the walked-on pointers left
 * behind in the registers: the last byte written, the count run down to zero, the destination
 * advanced by four per record within its page, and the source base advanced by one stride per
 * record. The stride itself is read-only.
 */
export function gatherSpriteRecords(m) {
  const { regs, mem } = m;

  const stride = regs.de; // bytes between successive object records (read-only)
  // The count is decremented before it is tested, so zero means 256 records rather than none.
  const count = regs.b === 0 ? 256 : regs.b;

  const hi = regs.h << 8; // the destination page is fixed for the whole routine
  let l = regs.l; // destination offset within that page; wraps rather than carrying out
  let ix = regs.ix; // source base, advanced one stride per record
  let a = 0; // the last byte written

  for (let i = 0; i < count; i++) {
    // Permuting gather: +3, +7, +8, +5 IN THIS ORDER into four consecutive dest bytes.
    for (const disp of [0x03, 0x07, 0x08, 0x05]) {
      a = mem.read8((ix + disp) & 0xffff);
      mem.write8(hi | l, a);
      l = (l + 1) & 0xff; // in-page wrap: the destination page never changes
    }
    ix = (ix + stride) & 0xffff;
  }

  // The walked-on pointers are left behind for the caller: the last byte written, the count run
  // down to zero, the destination advanced by four per record within its page, and the source
  // base advanced by one stride per record.
  regs.a = a;
  regs.l = l; // H untouched, so regs.hl reflects the advanced pointer
  regs.ix = ix;
  regs.b = 0;
}
