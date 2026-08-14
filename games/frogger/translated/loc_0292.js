// SPDX-License-Identifier: GPL-3.0-only

// loc_0292  (ROM 0x0292-0x02A2) — NMI in-play tail: count the word at (0x829D) down by one; when it
// reaches zero, store 0 into (0x83AE). Called from the NMI in-game branch (0x023E).
export function loc_0292(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x829d);
  m.step(0x0295, 16);
  regs.a = regs.h;
  m.step(0x0296, 4);
  regs.or(regs.l);
  m.step(0x0297, 4); // Z iff (0x829d) == 0
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  m.step(0x0298, 5);

  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x0299, 6);
  mem.write16(0x829d, regs.hl);
  m.step(0x029c, 16);
  regs.a = regs.h;
  m.step(0x029d, 4);
  regs.or(regs.l);
  m.step(0x029e, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x029f, 5);

  mem.write8(0x83ae, regs.a);
  m.step(0x02a2, 13); // (0x83ae) = 0 -- A is 0 after the h|l == 0 test
  m.ret();
}
