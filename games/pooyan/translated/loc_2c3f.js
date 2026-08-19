// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2c3f  (ROM 0x2c3f-0x2c4f) -- per-hunter-record dispatcher for loc_2c2c. Returns (true) if the
// slot is inactive (low bit of (ix+0)|(ix+1) clear) or its state (ix+0x02)&0x1f is below 0x11.
// Otherwise it dispatches ((ix+0x02)&0x1f)-0x11 via rst 0x28 into the inline table at 0x2c50
// {0->0x2c58, 1->0x2cb3, 2->0x2d24, 3->0x2d4a} and propagates the handler's boolean (loc_2c58 is a
// caller-skip). Boolean caller-skip protocol: own rets return true.
export function loc_2c3f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x2c42, 19); // 2c3f  ld a,(ix+0)
  regs.or(mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x2c45, 19); // 2c42  or (ix+1)
  regs.rrca(); m.step(0x2c46, 4); // 2c45  rrca
  if (regs.fNC) { m.ret(11); return true; } // 2c46  ret nc -- inactive slot
  m.step(0x2c47, 5);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x2c4a, 19); // 2c47  ld a,(ix+0x02)
  regs.and(0x1f); m.step(0x2c4c, 7); // 2c4a  and 0x1f
  regs.sub(0x11); m.step(0x2c4e, 7); // 2c4c  sub 0x11
  if (regs.fC) { m.ret(11); return true; } // 2c4e  ret c -- state below 0x11
  m.step(0x2c4f, 5);
  m.push16(0x2c50); m.step(0x0028, 11); // 2c4f  rst 0x28 (table base 0x2c50)
  return m.call(0x0028);
}
