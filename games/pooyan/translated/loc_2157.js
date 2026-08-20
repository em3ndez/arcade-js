// SPDX-License-Identifier: GPL-3.0-only

// loc_2157  (ROM 0x2157-0x2183) -- scan 2 records at 0x8c90 (stride 0x18), calling loc_21cf for
// each whose (iy+0) bit0 is set. Counter is held in 0x8f15 (seeded 2, decremented per pass). After
// the loop, tamper-check 0x8f00 against 0x0c + E(=0xc9 from 0x26c9): mismatch tail-jumps 0x22b1,
// match zeroes 0x8f02 and returns.
export function loc_2157(m) {
  const { regs, mem } = m;

  regs.iy = 0x8c90;                        m.step(0x215b, 14);
  regs.a = 0x02;                           m.step(0x215d, 7);

  for (;;) {
    mem.write8(0x8f15, regs.a);            m.step(0x2160, 13);
    regs.bit(0, mem.read8(regs.iy));       m.step(0x2164, 20);
    if (regs.fNZ) {
      m.push16(0x2167);
      m.step(0x21cf, 17);                  // 2164  call nz,0x21cf
      m.call(0x21cf);
    } else {
      m.step(0x2167, 10);                  // call nz not taken
    }
    regs.de = 0x0018;                      m.step(0x216a, 10);
    regs.addIy(regs.de);                   m.step(0x216c, 15);
    regs.a = mem.read8(0x8f15);            m.step(0x216f, 13);
    regs.sub(0x01);                        m.step(0x2171, 7);
    if (regs.fNZ) { m.step(0x215d, 12); continue; }
    m.step(0x2173, 7);                     // jr nz not taken
    break;
  }

  regs.a = mem.read8(0x8f00);              m.step(0x2176, 13);
  regs.de = 0x26c9;                        m.step(0x2179, 10);
  regs.sub(0x0c);                          m.step(0x217b, 7);
  regs.sub(regs.e);                        m.step(0x217c, 4);
  if (regs.fNZ) {
    m.step(0x22b1, 10);                    // 217c  jp nz,0x22b1 (tail)
    return m.call(0x22b1);
  }
  m.step(0x217f, 10);                      // jp nz not taken
  regs.xor(regs.a);                        m.step(0x2180, 4);
  mem.write8(0x8f02, regs.a);              m.step(0x2183, 13);
  m.ret(10);
}
