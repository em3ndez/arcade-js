// SPDX-License-Identifier: GPL-3.0-only

// loc_10f8  (ROM 0x10F8-0x1197) — frog-animation arms 6-10, siblings of the 0x1058 set and jp-table
// targets of the 0x0FAF dispatcher. Each reads its sprite triple at 0x828x into A/B/C, points HL at
// the arm's pattern table via (0x13xx), sets the IX/IY plot cursors, stashes A at (0x81B1) and DE at
// (0x8001), then jp's into the shared render loop 0x0FF1.
export function loc_10f8(m) {
  const { regs, mem } = m;

  regs.hl = 0x8282;
  m.step(0x10fb, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x10fc, 7); // A = (0x8282) sprite code
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x10fd, 6);
  regs.b = mem.read8(regs.hl);
  m.step(0x10fe, 7); // B = (0x8283)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x10ff, 6);
  regs.c = mem.read8(regs.hl);
  m.step(0x1100, 7); // C = (0x8284)
  regs.hl = mem.read16(0x13f9);
  m.step(0x1103, 16); // HL = (0x13f9) pattern-table pointer
  regs.de = 0x149f;
  m.step(0x1106, 10);
  regs.ix = 0x8136;
  m.step(0x110a, 14);
  regs.iy = 0x8136;
  m.step(0x110e, 14);
  mem.write8(0x81b1, regs.a);
  m.step(0x1111, 13); // (0x81b1) = sprite code
  mem.write16(0x8001, regs.de);
  m.step(0x1115, 20); // (0x8001) = DE
  m.step(0x0ff1, 10); // jp 0x0ff1
  return m.call(0x0ff1);
}

export function loc_1118(m) {
  const { regs, mem } = m;

  regs.hl = 0x8285;
  m.step(0x111b, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x111c, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x111d, 6);
  regs.b = mem.read8(regs.hl);
  m.step(0x111e, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x111f, 6);
  regs.c = mem.read8(regs.hl);
  m.step(0x1120, 7);
  regs.hl = mem.read16(0x13fb);
  m.step(0x1123, 16); // HL = (0x13fb) pattern-table pointer
  regs.de = 0x14a7;
  m.step(0x1126, 10);
  regs.ix = 0x813f;
  m.step(0x112a, 14);
  regs.iy = 0x813f;
  m.step(0x112e, 14);
  mem.write8(0x81b1, regs.a);
  m.step(0x1131, 13);
  mem.write16(0x8001, regs.de);
  m.step(0x1135, 20);
  m.step(0x0ff1, 10); // jp 0x0ff1
  return m.call(0x0ff1);
}

export function loc_1138(m) {
  const { regs, mem } = m;

  regs.hl = 0x8288;
  m.step(0x113b, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x113c, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x113d, 6);
  regs.b = mem.read8(regs.hl);
  m.step(0x113e, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x113f, 6);
  regs.c = mem.read8(regs.hl);
  m.step(0x1140, 7);
  regs.hl = mem.read16(0x13fd);
  m.step(0x1143, 16); // HL = (0x13fd) pattern-table pointer
  regs.de = 0x14ab;
  m.step(0x1146, 10);
  regs.ix = 0x8148;
  m.step(0x114a, 14);
  regs.iy = 0x8148;
  m.step(0x114e, 14);
  mem.write8(0x81b1, regs.a);
  m.step(0x1151, 13);
  mem.write16(0x8001, regs.de);
  m.step(0x1155, 20);
  m.step(0x0ff1, 10); // jp 0x0ff1
  return m.call(0x0ff1);
}

export function loc_1158(m) {
  const { regs, mem } = m;

  regs.hl = 0x828b;
  m.step(0x115b, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x115c, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x115d, 6);
  regs.b = mem.read8(regs.hl);
  m.step(0x115e, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x115f, 6);
  regs.c = mem.read8(regs.hl);
  m.step(0x1160, 7);
  regs.hl = mem.read16(0x13ff);
  m.step(0x1163, 16); // HL = (0x13ff) pattern-table pointer
  regs.de = 0x14af;
  m.step(0x1166, 10);
  regs.ix = 0x8151;
  m.step(0x116a, 14);
  regs.iy = 0x8151;
  m.step(0x116e, 14);
  mem.write8(0x81b1, regs.a);
  m.step(0x1171, 13);
  mem.write16(0x8001, regs.de);
  m.step(0x1175, 20);
  m.step(0x0ff1, 10); // jp 0x0ff1
  return m.call(0x0ff1);
}

export function loc_1178(m) {
  const { regs, mem } = m;

  regs.hl = 0x828e;
  m.step(0x117b, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x117c, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x117d, 6);
  regs.b = mem.read8(regs.hl);
  m.step(0x117e, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x117f, 6);
  regs.c = mem.read8(regs.hl);
  m.step(0x1180, 7);
  regs.hl = mem.read16(0x1401);
  m.step(0x1183, 16); // HL = (0x1401) pattern-table pointer
  regs.de = 0x14b3;
  m.step(0x1186, 10);
  regs.ix = 0x815a;
  m.step(0x118a, 14);
  regs.iy = 0x815a;
  m.step(0x118e, 14);
  mem.write8(0x81b1, regs.a);
  m.step(0x1191, 13);
  mem.write16(0x8001, regs.de);
  m.step(0x1195, 20);
  m.step(0x0ff1, 10); // jp 0x0ff1
  return m.call(0x0ff1);
}
