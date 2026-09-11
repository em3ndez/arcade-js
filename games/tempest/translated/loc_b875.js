// SPDX-License-Identifier: GPL-3.0-only
// loc_b875 (ROM 0xb875-0xb887) -- rotates the paired 3-entry arrays $22-$24 / $0809-$080b down by one
// (Y carries the wrap): for x=2,1,0 old $22+x is saved, $22+x := prior value, mirrored to $0809+x, then
// Y := old $22+x. bpl loops (same-page, taken=3). Net: $22..$24 rotate, $0809..$080b mirror the result.
export function loc_b875(m) {
  const { regs, mem } = m;
  regs.y = mem.read8(0x22); regs.setNZ(regs.y); m.step(0xb877, 3);          // ldy $22
  regs.x = 0x02; regs.setNZ(regs.x); m.step(0xb879, 2);                     // ldx #$02
  while (true) {
    { const e = (0x22 + regs.x) & 0xff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb87b, 4); } // lda $22,x
    m.push8(regs.a); m.step(0xb87c, 3);                                     // pha
    mem.write8((0x22 + regs.x) & 0xff, regs.y); m.step(0xb87e, 4);          // sty $22,x
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0xb87f, 2);                 // tya
    mem.write8((0x0809 + regs.x) & 0xffff, regs.a); m.step(0xb882, 5);      // sta $0809,x (store fixed 5)
    regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0xb883, 4);              // pla
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb884, 2);                 // tay
    regs.x = regs.dec8(regs.x); m.step(0xb885, 2);                          // dex
    if (regs.fPl) { m.step(0xb879, 3); continue; }                         // bpl same-page taken (x>=0)
    m.step(0xb887, 2); break;                                              // bpl not taken (x<0)
  }
  return m.ret(6); // 0xb887 rts
}
