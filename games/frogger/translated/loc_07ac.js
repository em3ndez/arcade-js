// SPDX-License-Identifier: GPL-3.0-only

// loc_07ac  (ROM 0x07AC-0x07C0) — sound-queue consumer: if (0x8300) is non-zero, decrement it,
// issue the command at (0x8301) via loc_0794, then shift the queue down one slot (LDIR of the
// pre-decrement count). Called from the NMI in-game branch (0x0103).
export function loc_07ac(m) {
  const { regs, mem } = m;

  regs.hl = 0x8300;
  m.step(0x07af, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x07b0, 7);
  regs.or(regs.a);
  m.step(0x07b1, 4); // Z iff (0x8300) == 0
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  m.step(0x07b2, 5);

  regs.decMem8(mem, regs.hl);
  m.step(0x07b3, 11); // (0x8300)--
  regs.c = regs.a;
  m.step(0x07b4, 4); // C = the pre-decrement count
  regs.l = regs.inc8(regs.l);
  m.step(0x07b5, 4);
  regs.a = mem.read8(regs.hl);
  m.step(0x07b6, 7); // A = (0x8301) command byte
  m.push16(0x07b9);
  m.step(0x0794, 17); // call 0x0794 -- issue the sound command
  m.call(0x0794);

  regs.d = regs.h;
  m.step(0x07ba, 4);
  regs.e = regs.l;
  m.step(0x07bb, 4); // DE = 0x8301
  regs.l = regs.inc8(regs.l);
  m.step(0x07bc, 4); // HL = 0x8302
  regs.b = 0x00;
  m.step(0x07be, 7); // BC = C -- bytes to shift
  m.ldirAt(0x07be, 0x07c0); // shift the queue down one slot
  m.ret();
}
