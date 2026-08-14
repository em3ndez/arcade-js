// SPDX-License-Identifier: GPL-3.0-only

// loc_0f69  (ROM 0x0F69-0x0F8B) — pack the P2 score (0x83EB) and high score (0x83ED) into the
// display field 0x83FB: order them so the larger word is packed first (DE) with the smaller left on
// the stack, run each through loc_0a84, and store (first-A -> 0x83FB, second-A -> 0x83FC).
export function loc_0f69(m) {
  const { regs, mem } = m;

  regs.de = mem.read16(0x83ed);
  m.step(0x0f6d, 20);
  regs.hl = mem.read16(0x83eb);
  m.step(0x0f70, 16);
  regs.b = regs.h;
  m.step(0x0f71, 4);
  regs.c = regs.l;
  m.step(0x0f72, 4); // BC = (0x83eb)
  regs.or(regs.a);
  m.step(0x0f73, 4); // clear carry
  regs.sbcHl(regs.de);
  m.step(0x0f75, 15); // (0x83eb) - (0x83ed)
  if (regs.fC) {
    m.step(0x0f7c, 12); // jr c,0x0f7c -- (0x83eb) < (0x83ed)
    m.push16(regs.bc);
    m.step(0x0f7d, 11); // push bc; DE stays (0x83ed)
  } else {
    m.step(0x0f77, 7);
    m.push16(regs.de);
    m.step(0x0f78, 11);
    m.push16(regs.bc);
    m.step(0x0f79, 11);
    regs.de = m.pop16();
    m.step(0x0f7a, 10); // pop de -- DE = BC = (0x83eb)
    m.step(0x0f7d, 12);
  }

  m.push16(0x0f80);
  m.step(0x0a84, 17);
  m.call(0x0a84);
  regs.de = m.pop16();
  m.step(0x0f81, 10); // pop de -- the smaller word
  m.push16(regs.af);
  m.step(0x0f82, 11); // push af -- save first A
  m.push16(0x0f85);
  m.step(0x0a84, 17);
  m.call(0x0a84);
  regs.h = regs.a;
  m.step(0x0f86, 4); // ld h,a -- second A -> high byte
  regs.af = m.pop16();
  m.step(0x0f87, 10); // pop af -- first A
  regs.l = regs.a;
  m.step(0x0f88, 4);
  mem.write16(0x83fb, regs.hl);
  m.step(0x0f8b, 16);
  m.ret();
}
