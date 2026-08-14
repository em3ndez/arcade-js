// SPDX-License-Identifier: GPL-3.0-only

// loc_0a5f  (ROM 0x0A5F-0x0A83) — award an extra life: clear (0x83CC), bump this player's life count
// (0x83B8 P1 / 0x83B9 P2), mirror it to (0x83B7), and — unless the count has reached 0x10 — stamp
// life-marker tile 0x4C into the lives row at 0xA85E + count*0x20.
export function loc_0a5f(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x0a60, 4);
  mem.write8(0x83cc, regs.a);
  m.step(0x0a63, 13); // (0x83CC) = 0

  regs.hl = 0x83b8;
  m.step(0x0a66, 10);
  regs.a = mem.read8(0x83fd);
  m.step(0x0a69, 13); // A = current player number
  regs.a = regs.dec8(regs.a);
  m.step(0x0a6a, 4); // Z iff player 1

  if (regs.fZ) {
    m.step(0x0a6d, 12); // jr z,0x0a6d -- player 1 keeps 0x83B8
  } else {
    m.step(0x0a6c, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x0a6d, 4); // inc l -- player 2: point at 0x83B9
  }

  regs.incMem8(mem, regs.hl);
  m.step(0x0a6e, 11); // life count++
  regs.a = mem.read8(regs.hl);
  m.step(0x0a6f, 7);
  mem.write8(0x83b7, regs.a);
  m.step(0x0a72, 13); // (0x83B7) = new count

  regs.cp(0x10);
  m.step(0x0a74, 7);
  if (regs.fNC) {
    m.ret(11); // ret nc -- count capped at 0x10, no marker
    return;
  }
  m.step(0x0a75, 5);

  regs.h = 0x00;
  m.step(0x0a77, 7);
  regs.de = 0xa85e;
  m.step(0x0a7a, 10);
  regs.add(regs.a);
  m.step(0x0a7b, 4);
  regs.add(regs.a);
  m.step(0x0a7c, 4);
  regs.add(regs.a);
  m.step(0x0a7d, 4);
  regs.add(regs.a);
  m.step(0x0a7e, 4); // A = count*0x10
  regs.l = regs.a;
  m.step(0x0a7f, 4);
  regs.addHl(regs.hl);
  m.step(0x0a80, 11); // HL = count*0x20
  regs.addHl(regs.de);
  m.step(0x0a81, 11); // HL = 0xA85E + count*0x20
  mem.write8(regs.hl, 0x4c);
  m.step(0x0a83, 10); // stamp marker tile 0x4C
  m.ret();
}
