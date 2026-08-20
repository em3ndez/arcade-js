// SPDX-License-Identifier: GPL-3.0-only

// loc_6368  (ROM 0x6368-0x6380) -- two-pass loop calling loc_6381 per pass. iy walks the 0x8848
// table (+4 each pass) and I latches the pass selector (0 first pass, then 4). The loop body at
// 0x6374 (djnz target, no external entry) is inlined. exx brackets the call so B/DE survive it.
export function loc_6368(m) {
  const { regs } = m;

  regs.iy = 0x8848;      m.step(0x636c, 14);
  regs.b = 0x02;         m.step(0x636e, 7);
  regs.de = 0x0004;      m.step(0x6371, 10);
  regs.xor(regs.a);      m.step(0x6372, 4);
  regs.i = regs.a;       m.step(0x6374, 9); // ld i,a -- I=0 for pass 1

  for (;;) { // loc_6374
    regs.exx();          m.step(0x6375, 4);
    m.push16(0x6378);
    m.step(0x6381, 17);  // 6375  call 0x6381
    m.call(0x6381);
    if (m.pc !== 0x6378) return;   // 0x6381 subtree skip-returned past this loop; propagate
    regs.exx();          m.step(0x6379, 4);
    regs.addIy(regs.de); m.step(0x637b, 15);
    regs.a = regs.e;     m.step(0x637c, 4);
    regs.i = regs.a;     m.step(0x637e, 9); // I=E=4 for pass 2
    if (regs.djnz()) { m.step(0x6374, 13); } else { m.step(0x6380, 8); break; }
  }
  return m.ret(10); // 6380  ret
}
