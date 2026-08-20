// SPDX-License-Identifier: GPL-3.0-only

// loc_42da  (ROM 0x42da-0x432c) -- object-slot initializer (iy = the slot).
// Bails if the slot is live (`ret c` on bit0 of (iy+0)|(iy+1)); otherwise marks it active,
// copies the 4-byte position block ix+3->iy+3 (ldir), seeds the anim/state fields, resolves
// an animation via loc_0c45/loc_5c75/loc_381e, then `pop af`+`ret` -- SKIP-RETURN: it discards
// its own return address and returns one frame up, aborting the caller's (loc_4221) spawn loop.
export function loc_42da(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.iy + 0x00) & 0xffff);   m.step(0x42dd, 19);
  regs.or(mem.read8((regs.iy + 0x01) & 0xffff));    m.step(0x42e0, 19);
  regs.rrca();                                      m.step(0x42e1, 4); // carry = bit0 (slot live?)
  if (regs.fC) { return m.ret(11); } // ret c -- slot busy, normal return to caller
  m.step(0x42e2, 5);

  mem.write8((regs.iy + 0x00) & 0xffff, 0x01);      m.step(0x42e6, 19);
  mem.write8((regs.iy + 0x02) & 0xffff, 0x0d);      m.step(0x42ea, 19);

  m.push16(regs.ix);                                m.step(0x42ec, 15); // HL = IX (via stack)
  regs.hl = m.pop16();                              m.step(0x42ed, 10);
  m.push16(regs.iy);                                m.step(0x42ef, 15); // DE = IY (via stack)
  regs.de = m.pop16();                              m.step(0x42f0, 10);

  regs.l = regs.inc8(regs.l);                       m.step(0x42f1, 4);
  regs.l = regs.inc8(regs.l);                       m.step(0x42f2, 4);
  regs.l = regs.inc8(regs.l);                       m.step(0x42f3, 4);
  regs.e = regs.inc8(regs.e);                       m.step(0x42f4, 4);
  regs.e = regs.inc8(regs.e);                       m.step(0x42f5, 4);
  regs.e = regs.inc8(regs.e);                       m.step(0x42f6, 4);
  regs.bc = 0x0004;                                 m.step(0x42f9, 10);
  m.ldirAt(0x42f9, 0x42fb); // copy 4 bytes ix+3->iy+3 (21T/iter, 16T last)

  regs.a = 0x2a;                                    m.step(0x42fd, 7);
  mem.write8((regs.iy + 0x09) & 0xffff, regs.a);    m.step(0x4300, 19);
  regs.neg();                                       m.step(0x4302, 8);
  mem.write8((regs.iy + 0x0a) & 0xffff, regs.a);    m.step(0x4305, 19);
  regs.hl = 0x432d;                                 m.step(0x4308, 10);
  regs.a = mem.read8(0x8907);                       m.step(0x430b, 13);
  regs.a = regs.srl(regs.a);                        m.step(0x430d, 8);
  regs.a = regs.dec8(regs.a);                       m.step(0x430e, 4);
  regs.and(0x03);                                   m.step(0x4310, 7);

  m.push16(0x4313);
  m.step(0x0c45, 17);                               // 4310  call 0x0c45
  m.call(0x0c45);
  m.push16(0x4316);
  m.step(0x5c75, 17);                               // 4313  call 0x5c75
  m.call(0x5c75);

  regs.xor(regs.a);                                 m.step(0x4317, 4);
  mem.write8(0x8d5b, regs.a);                       m.step(0x431a, 13);
  regs.de = 0x4347;                                 m.step(0x431d, 10);

  m.push16(0x4320);
  m.step(0x381e, 17);                               // 431d  call 0x381e (set animation)
  m.call(0x381e);

  mem.write8((regs.ix + 0x11) & 0xffff, 0x30);      m.step(0x4324, 19);
  mem.write8((regs.iy + 0x11) & 0xffff, 0x04);      m.step(0x4328, 19);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);     m.step(0x432b, 23);

  regs.af = m.pop16();                              m.step(0x432c, 10); // discard own return addr
  m.ret(10); // skip-return: aborts the caller's spawn loop
}
