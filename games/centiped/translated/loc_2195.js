// SPDX-License-Identifier: GPL-3.0-only
// loc_2195  (ROM 0x2195-0x21b3) -- indexes the 0x21c0 table via loc_21b3's Y, stashes $ae/$b0 and drives the
// $37d5/$385c/$384f writers; tail-JMPs $384f with A=0.
export function loc_2195(m) {
  const { regs, mem } = m;
  m.push16(0x2197); m.step(0x2198, 6); m.call(0x21b3);                                    // 2195 jsr $21b3
  mem.write8(0x00ae, regs.a); m.step(0x219a, 3);                        // 2198 sta $ae
  const _p = (0x21c0 + regs.y) & 0xffff; regs.a = mem.read8(_p); regs.setNZ(regs.a); m.step(0x219d, (0x21c0 & 0xff00) !== (_p & 0xff00) ? 5 : 4); // 219a lda $21c0,y
  mem.write8(0x00b0, regs.a); m.step(0x219f, 3);                        // 219d sta $b0
  regs.a = 0x06; regs.setNZ(regs.a); m.step(0x21a1, 2);                 // 219f lda #$06
  m.push16(0x21a3); m.step(0x21a4, 6); m.call(0x37d5);                                    // 21a1 jsr $37d5
  regs.a = mem.read8(0x00b0); regs.setNZ(regs.a); m.step(0x21a6, 3);    // 21a4 lda $b0
  m.push16(0x21a8); m.step(0x21a9, 6); m.call(0x385c);                                    // 21a6 jsr $385c
  regs.a = mem.read8(0x00ae); regs.setNZ(regs.a); m.step(0x21ab, 3);    // 21a9 lda $ae
  m.push16(0x21ad); m.step(0x21ae, 6); m.call(0x384f);                                    // 21ab jsr $384f
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x21b0, 2);                 // 21ae lda #$00
  m.step(0x384f, 3); return m.call(0x384f);                            // 21b0 jmp $384f
}
