// SPDX-License-Identifier: GPL-3.0-only

// loc_22b1  (ROM 0x22b1-0x22cf) -- run the animation stepper (loc_22e6) over four actor records.
// Gated on (0x8d32)==0. IX walks 0x8a80, 0x8a98, 0x8ab0, 0x8ac8 (stride 0x18); loc_22e6 advances
// each record's script and leaves IX/DE untouched, so the stride add is re-applied between calls.
export function loc_22b1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d32);  m.step(0x22b4, 13);
  regs.and(regs.a);            m.step(0x22b5, 4);
  if (regs.fNZ) { return m.ret(11); } // ret nz -- gate closed
  m.step(0x22b6, 5);           // ret nz not taken

  regs.ix = 0x8a80;            m.step(0x22ba, 14);
  m.push16(0x22bd);
  m.step(0x22e6, 17);          // 22ba  call 0x22e6
  m.call(0x22e6);
  regs.de = 0x0018;            m.step(0x22c0, 10);
  regs.addIx(regs.de);         m.step(0x22c2, 15);
  m.push16(0x22c5);
  m.step(0x22e6, 17);          // 22c2  call 0x22e6
  m.call(0x22e6);
  regs.addIx(regs.de);         m.step(0x22c7, 15);
  m.push16(0x22ca);
  m.step(0x22e6, 17);          // 22c7  call 0x22e6
  m.call(0x22e6);
  regs.addIx(regs.de);         m.step(0x22cc, 15);
  m.push16(0x22cf);
  m.step(0x22e6, 17);          // 22cc  call 0x22e6
  m.call(0x22e6);
  return m.ret(10);
}
