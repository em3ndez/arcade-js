// SPDX-License-Identifier: GPL-3.0-only

// loc_1fc7  (ROM 0x1FC7-0x1FD5) — gate on (0x826C): if zero return; else count (0x826A) down and,
// when it hits zero, clear (0x826C). Called from the NMI in-game branch (0x0238).
export function loc_1fc7(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x826c);
  m.step(0x1fca, 13);
  regs.and(regs.a);
  m.step(0x1fcb, 4); // Z iff (0x826c) == 0
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  m.step(0x1fcc, 5);

  regs.hl = 0x826a;
  m.step(0x1fcf, 10);
  regs.decMem8(mem, regs.hl);
  m.step(0x1fd0, 11); // (0x826a)--
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x1fd1, 5);

  regs.xor(regs.a);
  m.step(0x1fd2, 4);
  mem.write8(0x826c, regs.a);
  m.step(0x1fd5, 13); // (0x826c) = 0
  m.ret();
}
