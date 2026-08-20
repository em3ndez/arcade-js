// SPDX-License-Identifier: GPL-3.0-only

// loc_1a01  (ROM 0x1a01-0x1a46) -- gameplay-state handler: bumps the 0x8907 phase counter, seats the
// 0x8901 sprite attribute (0x30 if 0x8907>=2 else 0x28), and on the even-frame path either arms the
// 0x8f50 latch (0x8901=1, 0x8f4a=0x40) or clears the 0x8f45 block via rst 0x10 (loc_0010). Every exit
// falls into loc_1a47 (frame reuse, no push16); a closed credit gate (0x8806==0) tails to loc_1d3c.
export function loc_1a01(m) {
  const { regs, mem } = m;

  m.push16(0x1a04); m.step(0x2527, 17); m.call(0x2527);
  mem.write8(0x8902, regs.a);   m.step(0x1a07, 13);
  mem.write8(0x8934, regs.a);   m.step(0x1a0a, 13);
  regs.c = 0x30;                m.step(0x1a0c, 7);
  regs.a = mem.read8(0x8907);   m.step(0x1a0f, 13);
  regs.cp(0x02);                m.step(0x1a11, 7);
  if (regs.fNC) {
    m.step(0x1a15, 12);         // 0x8907 >= 2 -> attribute 0x30
  } else {
    m.step(0x1a13, 7);
    regs.c = 0x28;              m.step(0x1a15, 7);
  }
  regs.hl = 0x8901;             m.step(0x1a18, 10);
  mem.write8(regs.hl, regs.c);  m.step(0x1a19, 7);
  regs.l = 0x07;                m.step(0x1a1b, 7);
  regs.incMem8(mem, regs.hl);   m.step(0x1a1c, 11); // bump 0x8907
  regs.a = mem.read8(regs.hl);  m.step(0x1a1d, 7);
  regs.and(0x01);               m.step(0x1a1f, 7);
  if (regs.fNZ) {
    m.step(0x1a47, 12);         // odd frame -> tail into loc_1a47
    return m.call(0x1a47);
  }
  m.step(0x1a21, 7);
  regs.a = mem.read8(0x8806);   m.step(0x1a24, 13);
  regs.and(regs.a);             m.step(0x1a25, 4);
  if (regs.fZ) {
    m.step(0x1d3c, 10);         // credit gate closed -> tail to loc_1d3c
    return m.call(0x1d3c);
  }
  m.step(0x1a28, 10);
  regs.a = mem.read8(0x8f50);   m.step(0x1a2b, 13);
  regs.and(regs.a);             m.step(0x1a2c, 4);
  if (regs.fNZ) {
    m.step(0x1a3e, 12);         // 0x8f50 already set -> clear the 0x8f45 block
    regs.xor(regs.a);           m.step(0x1a3f, 4);
    regs.hl = 0x8f45;           m.step(0x1a42, 10);
    regs.b = 0x10;              m.step(0x1a44, 7);
    m.push16(0x1a45); m.step(0x0010, 11); m.call(0x0010); // rst 0x10 fill = 0
    regs.h = 0x81;              m.step(0x1a47, 7); // fall into loc_1a47 (HL hi = 0x81)
    return m.call(0x1a47);
  }
  m.step(0x1a2e, 7);
  regs.decMem8(mem, regs.hl);   m.step(0x1a2f, 11); // undo the 0x8907 bump
  regs.a = 0x01;                m.step(0x1a31, 7);
  mem.write8(0x8f50, regs.a);   m.step(0x1a34, 13);
  mem.write8(0x8901, regs.a);   m.step(0x1a37, 13);
  regs.a = 0x40;                m.step(0x1a39, 7);
  mem.write8(0x8f4a, regs.a);   m.step(0x1a3c, 13);
  m.step(0x1a47, 12);           // jr 0x1a47 -> tail into loc_1a47
  return m.call(0x1a47);
}
