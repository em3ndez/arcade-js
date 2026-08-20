// SPDX-License-Identifier: GPL-3.0-only

// loc_6bee  (ROM 0x6bee-0x6c17) -- step the timer selected by mode byte 0x8d52.
// 0 -> loc_6c18 (redraw); 1 sets bit2 / 2 sets bit3 of state byte 0x8a87 (clearing the other),
// then decrements counter 0x8d53. On the counter reaching 0 it also zeroes the mode byte 0x8d52.
export function loc_6bee(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d52);       m.step(0x6bf1, 13);
  regs.and(regs.a);                 m.step(0x6bf2, 4);
  if (regs.fZ) {
    m.step(0x6c14, 12);            // mode 0 -> redraw
    m.push16(0x6c17);
    m.step(0x6c18, 17);            // call 0x6c18 (boundary)
    m.call(0x6c18);
    m.ret();
    return;
  }
  m.step(0x6bf4, 7);
  regs.hl = 0x8a87;                 m.step(0x6bf7, 10);
  regs.a = regs.dec8(regs.a);       m.step(0x6bf8, 4);
  if (regs.fZ) {
    m.step(0x6c07, 12);           // mode 1
    mem.write8(regs.hl, regs.set(2, mem.read8(regs.hl)));  m.step(0x6c09, 15);
    mem.write8(regs.hl, regs.res(3, mem.read8(regs.hl)));  m.step(0x6c0b, 15);
    regs.hl = 0x8d53;             m.step(0x6c0e, 10);
    regs.decMem8(mem, regs.hl);   m.step(0x6c0f, 11);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x6c10, 5);
    regs.xor(regs.a);             m.step(0x6c11, 4);
    regs.l = regs.dec8(regs.l);   m.step(0x6c12, 4); // hl -> 0x8d52
    mem.write8(regs.hl, regs.a);  m.step(0x6c13, 7);
    m.ret();
    return;
  }
  m.step(0x6bfa, 7);              // mode >= 2
  mem.write8(regs.hl, regs.set(3, mem.read8(regs.hl)));   m.step(0x6bfc, 15);
  mem.write8(regs.hl, regs.res(2, mem.read8(regs.hl)));   m.step(0x6bfe, 15);
  regs.hl = 0x8d53;              m.step(0x6c01, 10);
  regs.decMem8(mem, regs.hl);    m.step(0x6c02, 11);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x6c03, 5);
  regs.xor(regs.a);             m.step(0x6c04, 4);
  regs.l = regs.dec8(regs.l);   m.step(0x6c05, 4); // hl -> 0x8d52
  mem.write8(regs.hl, regs.a);  m.step(0x6c06, 7);
  m.ret();
}
