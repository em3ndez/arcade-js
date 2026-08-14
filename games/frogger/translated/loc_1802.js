// SPDX-License-Identifier: GPL-3.0-only

// loc_1802  (ROM 0x1802-0x1840) — NMI sprite-animation stepper around 0x814F. Returns while (0x814F)
// or (0x815B) is busy. When the frame timer (0x81B4) is non-zero it just decrements it (loc_1832).
// Otherwise it reads a 16-bit source pointer from the table at 0x1841 indexed by (0x81B3), advances
// (0x81B3), reloads the timer (0x81B4)=0x15, wraps the index at 0x0A, and (loc_1837) LDIRs 0x0B bytes
// of the pointed frame into 0x819B. Called from the NMI in-game branch (0x01F5/0x011C).
export function loc_1802(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x814f);
  m.step(0x1805, 13);
  regs.and(regs.a);
  m.step(0x1806, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x1807, 5);

  regs.a = mem.read8(0x815b);
  m.step(0x180a, 13);
  regs.and(regs.a);
  m.step(0x180b, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x180c, 5);

  regs.a = mem.read8(0x81b4);
  m.step(0x180f, 13);
  regs.and(regs.a);
  m.step(0x1810, 4);
  if (regs.fNZ) {
    m.step(0x1832, 10);
    return block_1832();
  }
  m.step(0x1813, 10);

  regs.h = regs.a;
  m.step(0x1814, 4); // H = 0
  regs.a = mem.read8(0x81b3);
  m.step(0x1817, 13);
  regs.l = regs.a;
  m.step(0x1818, 4); // HL = index
  regs.de = 0x1841;
  m.step(0x181b, 10); // DE = pointer-table base
  regs.addHl(regs.hl);
  m.step(0x181c, 11); // HL = 2*index
  regs.addHl(regs.de);
  m.step(0x181d, 11); // HL = 0x1841 + 2*index
  regs.c = mem.read8(regs.hl);
  m.step(0x181e, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x181f, 6);
  regs.h = mem.read8(regs.hl);
  m.step(0x1820, 7);
  regs.l = regs.c;
  m.step(0x1821, 4); // HL = the 16-bit frame source
  regs.exDeHl();
  m.step(0x1822, 4); // DE = frame source
  regs.hl = 0x81b3;
  m.step(0x1825, 10);
  regs.incMem8(mem, regs.hl);
  m.step(0x1826, 11); // (0x81b3)++
  regs.a = mem.read8(regs.hl);
  m.step(0x1827, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1828, 6);
  mem.write8(regs.hl, 0x15);
  m.step(0x182a, 10); // (0x81b4) = 0x15 -- reload the frame timer
  regs.sub(0x0a);
  m.step(0x182c, 7);
  if (regs.fNZ) {
    m.step(0x1837, 10);
    return block_1837();
  }
  m.step(0x182f, 10);

  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x1830, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x1831, 7); // (0x81b3) = 0 -- index wrapped at 0x0a
  m.ret();

  function block_1832() {
    regs.hl = 0x81b4;
    m.step(0x1835, 10);
    regs.decMem8(mem, regs.hl);
    m.step(0x1836, 11); // (0x81b4)--
    m.ret();
  }

  function block_1837() {
    regs.exDeHl();
    m.step(0x1838, 4); // HL = frame source
    regs.de = 0x819b;
    m.step(0x183b, 10);
    regs.bc = 0x000b;
    m.step(0x183e, 10);
    m.ldirAt(0x183e, 0x1840); // copy 0x0b bytes -> 0x819b
    m.ret();
  }
}
