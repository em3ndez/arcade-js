// SPDX-License-Identifier: GPL-3.0-only
//
// loc_23a1  (ROM 0x23a1-0x23ac) -- shared phase-decrement tail. Decrements the 0x88bd counter,
// masks it to 0..7; while it stays non-zero the caller returns, otherwise it borrows into 0x88bc
// (dec) and falls into the render tail loc_23ad. Reached by fallthrough from loc_236a and by
// `jp 0x23a1` from loc_2901's dispatcher.
export function loc_23a1(m) {
  const { regs, mem } = m;

  regs.hl = 0x88bd; m.step(0x23a4, 10); // 23a1  ld hl,0x88bd
  regs.decMem8(mem, regs.hl); m.step(0x23a5, 11); // 23a4  dec (hl)
  regs.a = mem.read8(regs.hl); m.step(0x23a6, 7); // 23a5  ld a,(hl)
  regs.and(0x07); m.step(0x23a8, 7); // 23a6  and 0x07
  mem.write8(regs.hl, regs.a); m.step(0x23a9, 7); // 23a8  ld (hl),a
  regs.and(regs.a); m.step(0x23aa, 4); // 23a9  and a
  if (regs.fNZ) { m.ret(11); return; } // 23aa  ret nz
  m.step(0x23ab, 5);
  regs.hl = (regs.hl - 1) & 0xffff; m.step(0x23ac, 6); // 23ab  dec hl -> 0x88bc
  regs.decMem8(mem, regs.hl); m.step(0x23ad, 11); // 23ac  dec (hl)
  return m.call(0x23ad); // fall into loc_23ad
}
