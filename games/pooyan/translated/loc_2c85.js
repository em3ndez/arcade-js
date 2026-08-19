// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2c85  (ROM 0x2c85-0x2ca2) -- per-record helper for loc_2c58's sweep: only when the record's
// state (ix+0x02)==0x11 it bumps the state to 0x12, enqueues a display command (0x2ca7 -> loc_381e),
// seeds a script pointer (ix+0x16:0x17) = 0x2d00, and clears (ix+0x15). loc_381e is pattern A.
export function loc_2c85(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x2c88, 19); // 2c85  ld a,(ix+0x02)
  regs.cp(0x11); m.step(0x2c8a, 7); // 2c88  cp 0x11
  if (regs.fNZ) { m.ret(11); return; } // 2c8a  ret nz
  m.step(0x2c8b, 5);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x12); m.step(0x2c8f, 19); // 2c8b  ld (ix+0x02),0x12
  regs.de = 0x2ca7; m.step(0x2c92, 10); // 2c8f  ld de,0x2ca7
  m.push16(0x2c95); m.step(0x381e, 17); m.call(0x381e); // 2c92  call 0x381e (pattern A)
  regs.hl = 0x2d00; m.step(0x2c98, 10); // 2c95  ld hl,0x2d00
  mem.write8((regs.ix + 0x16) & 0xffff, regs.l); m.step(0x2c9b, 19); // 2c98  ld (ix+0x16),l
  mem.write8((regs.ix + 0x17) & 0xffff, regs.h); m.step(0x2c9e, 19); // 2c9b  ld (ix+0x17),h
  mem.write8((regs.ix + 0x15) & 0xffff, 0x00); m.step(0x2ca2, 19); // 2c9e  ld (ix+0x15),0x00
  m.ret(); // 2ca2  ret
}
