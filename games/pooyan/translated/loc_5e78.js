// SPDX-License-Identifier: GPL-3.0-only

// loc_5e78  (ROM 0x5e78-0x5e97) -- gated actor-sweep driver. Runs only when (0x8907) bit0 is set;
// then walks the 0x8848 table B=2 times (stride DE=4), calling the per-slot handler loc_5e98 with
// the I register as a phase latch (I=0 on the first pass, I=1 thereafter). The exx pair around the
// call parks the loop counter B and stride DE in the shadow set so loc_5e98's register clobbers
// cannot corrupt them. The 0x5e8a loop head is internal (djnz only) -- inlined, not its own routine.
export function loc_5e78(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907);        m.step(0x5e7b, 13);
  regs.and(0x01);                    m.step(0x5e7d, 7);
  if (regs.fZ) { return m.ret(11); } // ret z -- disabled
  m.step(0x5e7e, 5);

  regs.iy = 0x8848;                  m.step(0x5e82, 14);
  regs.b = 0x02;                     m.step(0x5e84, 7);
  regs.de = 0x0004;                  m.step(0x5e87, 10);
  regs.xor(regs.a);                  m.step(0x5e88, 4);
  regs.i = regs.a;                   m.step(0x5e8a, 9); // I=0 for the first pass

  for (;;) { // loc_5e8a: per-slot handler with B/DE parked in the shadow set
    regs.exx();                      m.step(0x5e8b, 4);
    m.push16(0x5e8e);
    m.step(0x5e98, 17);              // 5e8b  call 0x5e98 (per-slot handler)
    m.call(0x5e98);
    regs.exx();                      m.step(0x5e8f, 4);
    regs.addIy(regs.de);             m.step(0x5e91, 15);
    regs.a = 0x01;                   m.step(0x5e93, 7);
    regs.i = regs.a;                 m.step(0x5e95, 9); // I=1 for later passes
    if (regs.djnz()) { m.step(0x5e8a, 13); } else { m.step(0x5e97, 8); break; }
  }

  return m.ret(10); // 5e97 ret
}
