// SPDX-License-Identifier: GPL-3.0-only

// loc_6404  (ROM 0x6404-0x6428) -- guarded two-pass loop calling loc_6435 per pass. Guard: if
// 0x8f50 is set, run; else run only when 0x8907 bit0 is clear (ret nz otherwise). The loop mirrors
// loc_6368 -- iy walks 0x8848 (+4/pass), I latches the pass selector, exx brackets the call. The
// loop body at 0x641c (djnz target, no external entry) is inlined.
export function loc_6404(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f50); m.step(0x6407, 13);
  regs.and(regs.a);           m.step(0x6408, 4);
  if (regs.fNZ) {
    m.step(0x6410, 12);       // jr nz,0x6410 -- 0x8f50 set, skip the bit0 gate
  } else {
    m.step(0x640a, 7);
    regs.a = mem.read8(0x8907); m.step(0x640d, 13);
    regs.and(0x01);             m.step(0x640f, 7);
    if (regs.fNZ) { return m.ret(11); } // ret nz -- bit0 set, do nothing
    m.step(0x6410, 5);
  }

  // 0x6410: the exx loop
  regs.iy = 0x8848;      m.step(0x6414, 14);
  regs.b = 0x02;         m.step(0x6416, 7);
  regs.de = 0x0004;      m.step(0x6419, 10);
  regs.xor(regs.a);      m.step(0x641a, 4);
  regs.i = regs.a;       m.step(0x641c, 9); // I=0 for pass 1

  for (;;) { // loc_641c
    regs.exx();          m.step(0x641d, 4);
    m.push16(0x6420);
    m.step(0x6435, 17);  // 641d  call 0x6435
    m.call(0x6435);
    regs.exx();          m.step(0x6421, 4);
    regs.addIy(regs.de); m.step(0x6423, 15);
    regs.a = regs.e;     m.step(0x6424, 4);
    regs.i = regs.a;     m.step(0x6426, 9); // I=E=4 for pass 2
    if (regs.djnz()) { m.step(0x641c, 13); } else { m.step(0x6428, 8); break; }
  }
  return m.ret(10); // 6428  ret
}
