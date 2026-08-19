// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2514  (ROM 0x2514-0x2526) -- copy B display tiles from (HL) into (ix+0x0f), advancing HL by 1
// and IX by DE (0x18, one actor record) each pass. Entered by fallthrough from loc_250f and directly
// (HL/B/DE preset) from 0x65e6 / 0x66bb. After the loop, if (0x8df9)|(0x89e5) is non-zero it tail-
// jumps to loc_2527, otherwise it returns.
export function loc_2514(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.a = mem.read8(regs.hl); m.step(0x2515, 7); // 2514  ld a,(hl)
    mem.write8((regs.ix + 0x0f) & 0xffff, regs.a); m.step(0x2518, 19); // 2515  ld (ix+0x0f),a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2519, 6); // 2518  inc hl
    regs.addIx(regs.de); m.step(0x251b, 15); // 2519  add ix,de
    if (regs.djnz() !== 0) { m.step(0x2514, 13); continue; } // 251b  djnz 0x2514
    m.step(0x251d, 8); break;
  }
  regs.hl = 0x89e5; m.step(0x2520, 10); // 251d  ld hl,0x89e5
  regs.a = mem.read8(0x8df9); m.step(0x2523, 13); // 2520  ld a,(0x8df9)
  regs.or(mem.read8(regs.hl)); m.step(0x2524, 7); // 2523  or (hl)
  if (regs.fNZ) { m.step(0x2527, 12); return m.call(0x2527); } // 2524  jr nz,0x2527
  m.step(0x2526, 7);
  m.ret(); // 2526  ret
}
