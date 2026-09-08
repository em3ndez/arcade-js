// SPDX-License-Identifier: GPL-3.0-only
// loc_2656  (ROM 0x2656-0x2675) -- reads a 3-byte record at $2676,X and fans it out to the two motion-object
// register triples $140D-$140F and $1405-$1407; RTS.
export function loc_2656(m) {
  const { regs, mem } = m;
  let a; // effective address for page-cross accounting
  a = (0x2676 + regs.x) & 0xffff;
  regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0x2659, 4 + ((0x2676 & 0xff00) !== (a & 0xff00) ? 1 : 0)); // 2656 lda $2676,x
  m.push8(regs.a); m.step(0x265a, 3);                                                                          // 2659 pha
  a = (0x2677 + regs.x) & 0xffff;
  regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0x265d, 4 + ((0x2677 & 0xff00) !== (a & 0xff00) ? 1 : 0)); // 265a lda $2677,x
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x265e, 2);                                                      // 265d tay
  a = (0x2678 + regs.x) & 0xffff;
  regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0x2661, 4 + ((0x2678 & 0xff00) !== (a & 0xff00) ? 1 : 0)); // 265e lda $2678,x
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0x2662, 2);                                                      // 2661 tax
  regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x2663, 4);                                                   // 2662 pla
  mem.write8(0x140e, regs.x); m.step(0x2666, 4);                                                               // 2663 stx $140e
  mem.write8(0x1406, regs.x); m.step(0x2669, 4);                                                               // 2666 stx $1406
  mem.write8(0x140f, regs.a); m.step(0x266c, 4);                                                               // 2669 sta $140f
  mem.write8(0x1405, regs.a); m.step(0x266f, 4);                                                               // 266c sta $1405
  mem.write8(0x140d, regs.y); m.step(0x2672, 4);                                                               // 266f sty $140d
  mem.write8(0x1407, regs.y); m.step(0x2675, 4);                                                               // 2672 sty $1407
  return m.ret(6);                                                                                             // 2675 rts
}
