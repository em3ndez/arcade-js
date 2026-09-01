// SPDX-License-Identifier: GPL-3.0-only
// loc_09d6  (ROM 0x09d6-0x09ee) -- clear the play-field video RAM from 0x2402: write 0 at (hl),
// step, and when the low 5 bits of L reach 0x1c skip a 6-byte gap (dad 0x0006); loop until H==0x40.
// Interior labels 0x09d9 (loop top) and 0x09e8 (post-gap merge) are JS control flow, not heads.
export function loc_09d6(m) {
  const { regs, mem } = m;

  regs.hl = 0x2402; m.step(0x09d9, 10); // 09d6  lxi h,0x2402
  for (;;) {
    mem.write8(regs.hl, 0x00); m.step(0x09db, 10); // 09d9  mvi m,0x00
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x09dc, 5); // 09db  inx h
    regs.a = regs.l; m.step(0x09dd, 5); // 09dc  mov a,l
    regs.and(0x1f); m.step(0x09df, 7); // 09dd  ani 0x1f
    regs.cp(0x1c); m.step(0x09e1, 7); // 09df  cpi 0x1c
    if (regs.fC) {
      m.step(0x09e8, 10); // 09e1  jc 0x09e8 (taken)
    } else {
      m.step(0x09e4, 10); // 09e1  jc 0x09e8 (not taken)
      regs.de = 0x0006; m.step(0x09e7, 10); // 09e4  lxi d,0x0006
      regs.addHl(regs.de); m.step(0x09e8, 10); // 09e7  dad d
    }
    regs.a = regs.h; m.step(0x09e9, 5); // 09e8  mov a,h
    regs.cp(0x40); m.step(0x09eb, 7); // 09e9  cpi 0x40
    if (regs.fC) { m.step(0x09d9, 10); continue; } // 09eb  jc 0x09d9 (taken)
    m.step(0x09ee, 10); // 09eb  jc 0x09d9 (not taken)
    break;
  }
  return m.ret(10); // 09ee  ret
}
