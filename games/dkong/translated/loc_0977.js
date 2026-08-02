// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0977  (ROM 0x0977–0x0985) — BCD-decrement 0x6001, then enqueue.
 *
 *   0977  21 01 60     ld   hl,0x6001
 *   097a  3e 99        ld   a,0x99
 *   097c  86           add  a,(hl)        ; A = 0x99 + (0x6001)
 *   097d  27           daa                ; -> BCD ((0x6001) - 1)
 *   097e  77           ld   (hl),a
 *   097f  11 00 04     ld   de,0x0400
 *   0982  cd 9f 30     call 0x309f
 *   0985  c9           ret
 */
export function loc_0977(m) {
  const { regs, mem } = m;

  regs.hl = 0x6001;
  m.step(0x097a, 10); // ld hl,0x6001
  regs.a = 0x99;
  m.step(0x097c, 7); // ld a,0x99
  regs.add(mem.read8(regs.hl)); // add a,(hl) -- sets H/C that daa consumes
  m.step(0x097d, 7);
  regs.daa(); // -> BCD (v - 1); N=0 branch
  m.step(0x097e, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x097f, 7); // ld (hl),a

  regs.de = 0x0400;
  m.step(0x0982, 10); // ld de,0x0400
  m.push16(0x0985); // call 0x309f -- balanced, not skip-capable
  m.step(0x309f, 17);
  m.call(0x309f);
  m.ret(); // ret (0x0985)
}
