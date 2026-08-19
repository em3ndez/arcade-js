// SPDX-License-Identifier: GPL-3.0-only
//
// loc_324d  (ROM 0x324d-0x3265) -- per-slot hunter-return handler. For a slot whose (ix+0x00) >= 0x40
// it ticks a 0x8c-page counter (0x8c00 + (ix+0x00)+5) down by 0x40; on borrow it decrements the paired
// byte and, when (0x89e5) is set, tail-jumps to the board-clear check loc_3278. Called from loc_323e.
export function loc_324d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x3250, 19); // 324d  ld a,(ix+0)
  regs.cp(0x40); m.step(0x3252, 7);
  if (regs.fC) { m.ret(11); return; }
  m.step(0x3253, 5);
  regs.h = 0x8c; m.step(0x3255, 7);
  regs.add(0x05); m.step(0x3257, 7);
  regs.l = regs.a; m.step(0x3258, 4);
  regs.a = mem.read8(regs.hl); m.step(0x3259, 7); // 3258  ld a,(hl)
  regs.sub(0x40); m.step(0x325b, 7);
  mem.write8(regs.hl, regs.a); m.step(0x325c, 7); // 325b  ld (hl),a
  if (regs.fNC) { m.ret(11); return; }
  m.step(0x325d, 5);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x325e, 6);
  regs.decMem8(mem, regs.hl); m.step(0x325f, 11); // 325e  dec (hl)
  regs.a = mem.read8(0x89e5); m.step(0x3262, 13); // 325f  ld a,(0x89e5)
  regs.and(regs.a); m.step(0x3263, 4);
  if (regs.fNZ) { m.step(0x3278, 12); return m.call(0x3278); }
  m.step(0x3265, 7);
  m.ret();
}
