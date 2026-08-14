// SPDX-License-Identifier: GPL-3.0-only

// loc_0804  (ROM 0x0804-0x0821) — frog-object init at 0x8044: (0x8044)=1, (0x8045)=(0x8047)=0. In a
// 2-player game ((0x83FE)==2) also seed the two 16-bit timers (0x83D2)/(0x83DA)=0x0040. Called from
// loc_0457 (0x0461).
export function loc_0804(m) {
  const { regs, mem } = m;

  regs.hl = 0x8044;
  m.step(0x0807, 10);
  regs.xor(regs.a);
  m.step(0x0808, 4);
  mem.write8(regs.hl, 0x01);
  m.step(0x080a, 10); // (0x8044) = 1 -- frog object active
  regs.l = regs.inc8(regs.l);
  m.step(0x080b, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x080c, 7); // (0x8045) = 0
  regs.l = regs.inc8(regs.l);
  m.step(0x080d, 4);
  regs.l = regs.inc8(regs.l);
  m.step(0x080e, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x080f, 7); // (0x8047) = 0
  regs.a = mem.read8(0x83fe);
  m.step(0x0812, 13);
  regs.cp(0x02);
  m.step(0x0814, 7);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x0815, 5);

  regs.hl = 0x0040;
  m.step(0x0818, 10);
  mem.write16(0x83d2, regs.hl);
  m.step(0x081b, 16); // (0x83d2) = 0x0040
  regs.hl = 0x0040;
  m.step(0x081e, 10);
  mem.write16(0x83da, regs.hl);
  m.step(0x0821, 16); // (0x83da) = 0x0040
  m.ret();
}
