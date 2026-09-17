// SPDX-License-Identifier: GPL-3.0-only
/**
 * gatherSpriteRecords — build a run of hardware sprite records by gathering four permuted
 * fields (+3, +7, +8, +5 in that order) out of each of a caller-supplied count of object
 * records into four consecutive destination bytes. Count, dest pointer, source base and
 * per-record stride all arrive in registers. The dest advances in its low byte only (wraps
 * within its 256-byte page); a count of zero means 256 records.
 *
 * LIVE-OUT: memory — four bytes per record at the destination — plus the walked-on registers:
 * A = last byte written, B = 0, dest advanced 4 per record within its page, source base
 * advanced one stride per record. The stride is read-only.
 */
export function gatherSpriteRecords(m) {
  const { regs, mem8 } = m;

  const stride = regs.de;
  const count = regs.b === 0 ? 256 : regs.b;

  const hi = regs.h << 8; // fixed destination page
  let l = regs.l;
  let ix = regs.ix;
  let a = 0;

  for (let i = 0; i < count; i++) {
    for (const disp of [0x03, 0x07, 0x08, 0x05]) {
      a = mem8[(ix + disp) & 0xffff];
      mem8[hi | l] = a;
      l = (l + 1) & 0xff; // in-page wrap: the destination page never changes
    }
    ix = (ix + stride) & 0xffff;
  }

  regs.a = a;
  regs.l = l;
  regs.ix = ix;
  regs.b = 0;
}
