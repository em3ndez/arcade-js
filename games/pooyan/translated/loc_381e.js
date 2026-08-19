// SPDX-License-Identifier: GPL-3.0-only

// loc_381e  (ROM 0x381e-0x3828) -- SET ANIMATION helper. Stores DE into the actor's
// animation-sequence pointer (ix+0x0c:ix+0x0d) and zeroes the frame index (ix+0x0e).
// Called from ~40 sites as `ld de,<anim table>; call 0x381e` (the tables at 0x3829/0x3838/
// 0x3847/0x3856/0x3bd1/... are 4-frame {attr,tile,colour} loops consumed by the anim player).
export function loc_381e(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x0c) & 0xffff, regs.e);
  m.step(0x3821, 19); // 381e  ld (ix+0x0c),e
  mem.write8((regs.ix + 0x0d) & 0xffff, regs.d);
  m.step(0x3824, 19); // 3821  ld (ix+0x0d),d
  mem.write8((regs.ix + 0x0e) & 0xffff, 0x00);
  m.step(0x3828, 19); // 3824  ld (ix+0x0e),0x00
  m.ret(); // 3828  ret
}
