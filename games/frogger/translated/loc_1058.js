// SPDX-License-Identifier: GPL-3.0-only

// loc_1058  (ROM 0x1058-0x10DD) — frog-animation arms 1-5, each a jp-table target of the 0x0FAF
// dispatcher. An arm reads its sprite triple at 0x827x into A/B/C, points HL at the arm's pattern
// table via (0x13xx), sets the IX/IY plot cursors, stashes A at (0x81B1) and DE at (0x8001), then
// jp's into the shared render loop 0x0FF1. Arm 0x10DB is a bare jp to sibling 0x1029.
export function loc_1058(m) {
  const { regs, mem } = m;

  m.push16(0x105b);
  m.step(0x0f8c, 17);
  m.call(0x0f8c); // call 0x0f8c -- frog-anim pre-helper
  regs.hl = 0x8273;
  m.step(0x105e, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x105f, 7); // A = (0x8273) sprite code
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1060, 6);
  regs.b = mem.read8(regs.hl);
  m.step(0x1061, 7); // B = (0x8274)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1062, 6);
  regs.c = mem.read8(regs.hl);
  m.step(0x1063, 7); // C = (0x8275)
  regs.hl = mem.read16(0x13ef);
  m.step(0x1066, 16); // HL = (0x13ef) pattern-table pointer
  regs.de = 0x1423;
  m.step(0x1069, 10);
  regs.ix = 0x8109;
  m.step(0x106d, 14);
  regs.iy = 0x8109;
  m.step(0x1071, 14);
  mem.write8(0x81b1, regs.a);
  m.step(0x1074, 13); // (0x81b1) = sprite code
  mem.write16(0x8001, regs.de);
  m.step(0x1078, 20); // (0x8001) = DE
  m.step(0x0ff1, 10); // jp 0x0ff1
  return m.call(0x0ff1);
}

export function loc_107b(m) {
  const { regs, mem } = m;

  regs.hl = 0x8276;
  m.step(0x107e, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x107f, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1080, 6);
  regs.b = mem.read8(regs.hl);
  m.step(0x1081, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1082, 6);
  regs.c = mem.read8(regs.hl);
  m.step(0x1083, 7);
  regs.hl = mem.read16(0x13f1);
  m.step(0x1086, 16); // HL = (0x13f1) pattern-table pointer
  regs.de = 0x143b;
  m.step(0x1089, 10);
  regs.ix = 0x8112;
  m.step(0x108d, 14);
  regs.iy = 0x8112;
  m.step(0x1091, 14);
  mem.write8(0x81b1, regs.a);
  m.step(0x1094, 13);
  mem.write16(0x8001, regs.de);
  m.step(0x1098, 20);
  m.step(0x0ff1, 10); // jp 0x0ff1
  return m.call(0x0ff1);
}

export function loc_109b(m) {
  const { regs, mem } = m;

  regs.hl = 0x8279;
  m.step(0x109e, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x109f, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x10a0, 6);
  regs.b = mem.read8(regs.hl);
  m.step(0x10a1, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x10a2, 6);
  regs.c = mem.read8(regs.hl);
  m.step(0x10a3, 7);
  regs.hl = mem.read16(0x13f3);
  m.step(0x10a6, 16); // HL = (0x13f3) pattern-table pointer
  regs.de = 0x1453;
  m.step(0x10a9, 10);
  regs.ix = 0x811b;
  m.step(0x10ad, 14);
  regs.iy = 0x811b;
  m.step(0x10b1, 14);
  mem.write8(0x81b1, regs.a);
  m.step(0x10b4, 13);
  mem.write16(0x8001, regs.de);
  m.step(0x10b8, 20);
  m.step(0x0ff1, 10); // jp 0x0ff1
  return m.call(0x0ff1);
}

export function loc_10bb(m) {
  const { regs, mem } = m;

  regs.hl = 0x827c;
  m.step(0x10be, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x10bf, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x10c0, 6);
  regs.b = mem.read8(regs.hl);
  m.step(0x10c1, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x10c2, 6);
  regs.c = mem.read8(regs.hl);
  m.step(0x10c3, 7);
  regs.hl = mem.read16(0x13f5);
  m.step(0x10c6, 16); // HL = (0x13f5) pattern-table pointer
  regs.de = 0x145f;
  m.step(0x10c9, 10);
  regs.ix = 0x8124;
  m.step(0x10cd, 14);
  regs.iy = 0x8124;
  m.step(0x10d1, 14);
  mem.write8(0x81b1, regs.a);
  m.step(0x10d4, 13);
  mem.write16(0x8001, regs.de);
  m.step(0x10d8, 20);
  m.step(0x0ff1, 10); // jp 0x0ff1
  return m.call(0x0ff1);
}

export function loc_10db(m) {
  m.step(0x1029, 10); // jp 0x1029 -- delegate to the sibling arm body
  return m.call(0x1029);
}
