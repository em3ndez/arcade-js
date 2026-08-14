// SPDX-License-Identifier: GPL-3.0-only

// loc_2bfb  (ROM 0x2BFB-0x2C12) — IX sprite-object arm. If the object's (ix+0x06) state is 0 it returns;
// otherwise it indexes the byte table at 0x2CD9 by that state, ORs in (ix+0x05), stores the result to
// (iy+0x01), and sets (iy+0x02)=0x02. Leaf; IX = object record, IY = sprite slot.
export function loc_2bfb(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x2bfe, 19); // (ix+0x06) -- object state
  regs.or(regs.a);
  m.step(0x2bff, 4);
  if (regs.fZ) { m.ret(11); return; } // ret z -- inactive
  m.step(0x2c00, 5);
  regs.hl = 0x2cd9;
  m.step(0x2c03, 10);
  regs.c = regs.a;
  m.step(0x2c04, 4);
  regs.b = 0x00;
  m.step(0x2c06, 7); // BC = state index
  regs.addHl(regs.bc);
  m.step(0x2c07, 11);
  regs.a = mem.read8(regs.hl); // (0x2CD9 + state)
  m.step(0x2c08, 7);
  regs.or(mem.read8((regs.ix + 0x05) & 0xffff)); // | (ix+0x05)
  m.step(0x2c0b, 19);
  mem.write8((regs.iy + 0x01) & 0xffff, regs.a);
  m.step(0x2c0e, 19); // (iy+0x01) = attribute
  mem.write8((regs.iy + 0x02) & 0xffff, 0x02);
  m.step(0x2c12, 19); // (iy+0x02) = 0x02
  m.ret();
}
