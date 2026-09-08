// SPDX-License-Identifier: GPL-3.0-only
// loc_21b3  (ROM 0x21b3-0x21be) -- reads $FD, isolates bits 5-4 (>>3 to a 0..6 even index), and returns
// the 0x21BF byte-table entry at that index (A); RTS.
export function loc_21b3(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x00fd); regs.setNZ(regs.a); m.step(0x21b5, 3);                     // 21b3 lda $fd
  regs.and(0x30); m.step(0x21b7, 2);                                                     // 21b5 and #$30
  regs.a = regs.lsr(regs.a); m.step(0x21b8, 2);                                          // 21b7 lsr a
  regs.a = regs.lsr(regs.a); m.step(0x21b9, 2);                                          // 21b8 lsr a
  regs.a = regs.lsr(regs.a); m.step(0x21ba, 2);                                          // 21b9 lsr a
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x21bb, 2);                                // 21ba tay
  regs.a = mem.read8((0x21bf + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x21be, 4); // 21bb lda $21bf,y
  return m.ret(6);                                                                       // 21be rts
}
