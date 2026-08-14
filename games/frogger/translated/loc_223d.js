// SPDX-License-Identifier: GPL-3.0-only

// loc_223d  (ROM 0x223D-0x225F) — load the per-difficulty lane-parameter block. Under EXX, read the
// current player's difficulty index ((0x8293) for P1, (0x8294) for P2), look up a pointer in the
// 5-entry table at 0x2260 (2*index), and LDIR 0x21 bytes of that block into 0x8270. Called at
// game-start and from the board-init path (0x0D4C).
export function loc_223d(m) {
  const { regs, mem } = m;

  regs.exx();
  m.step(0x223e, 4); // exx -- caller's BC/DE/HL preserved
  regs.hl = 0x8293;
  m.step(0x2241, 10);
  regs.a = mem.read8(0x83fd);
  m.step(0x2244, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x2245, 4); // Z iff (0x83fd) == 1 (player 1)
  if (regs.fZ) {
    m.step(0x2248, 12);
  } else {
    m.step(0x2247, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x2248, 4); // player 2 -> (0x8294)
  }
  regs.a = mem.read8(regs.hl);
  m.step(0x2249, 7); // A = difficulty index
  regs.bc = 0x2260;
  m.step(0x224c, 10); // BC = pointer-table base
  regs.h = 0x00;
  m.step(0x224e, 7);
  regs.l = regs.a;
  m.step(0x224f, 4);
  regs.add(regs.l);
  m.step(0x2250, 4); // A = 2*index
  regs.l = regs.a;
  m.step(0x2251, 4);
  regs.addHl(regs.bc);
  m.step(0x2252, 11); // HL = 0x2260 + 2*index
  regs.e = mem.read8(regs.hl);
  m.step(0x2253, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2254, 6);
  regs.d = mem.read8(regs.hl);
  m.step(0x2255, 7); // DE = the lane-param block pointer
  regs.exDeHl();
  m.step(0x2256, 4);
  regs.de = 0x8270;
  m.step(0x2259, 10);
  regs.bc = 0x0021;
  m.step(0x225c, 10);
  m.ldirAt(0x225c, 0x225e); // copy 0x21 bytes -> 0x8270
  regs.exx();
  m.step(0x225f, 4);
  m.ret();
}
