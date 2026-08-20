// SPDX-License-Identifier: GPL-3.0-only

// loc_0ea2  (ROM 0x0ea2-0x0ece) -- append tile A into the 0x8a00-page text ring.
// A is latched at 0x8d20, then written (as B) into mem[0x8a00 | cursor], cursor = mem[0x8a40].
// The cursor advances 0x43..0x5e and wraps 0x5e -> 0x43. Gated: when 0x8806 == 0 AND 0x8f50 == 0
// it returns without appending. Leaf; push bc/de/hl framed by the matching pops. No calls.
export function loc_0ea2(m) {
  const { regs, mem } = m;

  mem.write8(0x8d20, regs.a);        m.step(0x0ea5, 13);
  regs.a = mem.read8(0x8806);        m.step(0x0ea8, 13);
  regs.and(regs.a);                  m.step(0x0ea9, 4);
  if (regs.fNZ) {
    m.step(0x0eb0, 12);              // jr nz,0x0eb0 taken
  } else {
    m.step(0x0eab, 7);               // jr nz not taken
    regs.a = mem.read8(0x8f50);      m.step(0x0eae, 13);
    regs.and(regs.a);                m.step(0x0eaf, 4);
    if (regs.fZ) { m.ret(11); return; } // ret z -- both gates closed
    m.step(0x0eb0, 5);               // ret z not taken
  }

  regs.a = mem.read8(0x8d20);        m.step(0x0eb3, 13);
  m.push16(regs.bc);                 m.step(0x0eb4, 11);
  m.push16(regs.de);                 m.step(0x0eb5, 11);
  m.push16(regs.hl);                 m.step(0x0eb6, 11);
  regs.b = regs.a;                   m.step(0x0eb7, 4);
  regs.de = 0x8a40;                  m.step(0x0eba, 10);
  regs.a = mem.read8(regs.de);       m.step(0x0ebb, 7);
  regs.l = regs.a;                   m.step(0x0ebc, 4);
  regs.h = 0x8a;                     m.step(0x0ebe, 7);
  mem.write8(regs.hl, regs.b);       m.step(0x0ebf, 7);
  regs.a = regs.l;                   m.step(0x0ec0, 4);
  regs.cp(0x5e);                     m.step(0x0ec2, 7);
  if (regs.fZ) {
    m.step(0x0ec8, 12);              // jr z,0x0ec8 taken -- cursor at end
    regs.a = 0x43;                   m.step(0x0eca, 7); // wrap to start
    mem.write8(regs.de, regs.a);     m.step(0x0ecb, 7);
  } else {
    m.step(0x0ec4, 7);               // jr z not taken
    regs.a = regs.inc8(regs.a);      m.step(0x0ec5, 4); // advance cursor
    mem.write8(regs.de, regs.a);     m.step(0x0ec6, 7);
    m.step(0x0ecb, 12);              // jr 0x0ecb
  }

  regs.hl = m.pop16();               m.step(0x0ecc, 10);
  regs.de = m.pop16();               m.step(0x0ecd, 10);
  regs.bc = m.pop16();               m.step(0x0ece, 10);
  m.ret(10);
}
