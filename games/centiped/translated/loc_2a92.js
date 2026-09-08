// SPDX-License-Identifier: GPL-3.0-only
// loc_2a92  (ROM 0x2a92-0x2aa5) -- adds $44,x into $54,x, calls loc_2c96, then on carry-clear tail-jumps to
// loc_2acd, else tests ($64,x & 7)==4 to pick loc_2ac7 (BNE) or fall into loc_2aa6.
export function loc_2a92(m) {
  const { regs, mem } = m;
  regs.a = mem.read8((0x0044 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2a94, 4); // 2a92 lda $44,x
  regs.clc(); m.step(0x2a95, 2);                                                        // 2a94 clc
  regs.adc(mem.read8((0x0054 + regs.x) & 0xff)); m.step(0x2a97, 4);                     // 2a95 adc $54,x
  mem.write8((0x0054 + regs.x) & 0xff, regs.a); m.step(0x2a99, 4);                      // 2a97 sta $54,x
  m.push16(0x2a9b); m.step(0x2a9c, 6); m.call(0x2c96);                                                    // 2a99 jsr $2c96
  if (regs.fNC) { m.step(0x2acd, 3); return m.call(0x2acd); }                           // 2a9c bcc $2acd
  m.step(0x2a9e, 2);                                                                    // 2a9c bcc (fall)
  regs.a = mem.read8((0x0064 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2aa0, 4);  // 2a9e lda $64,x
  regs.and(0x07); m.step(0x2aa2, 2);                                                    // 2aa0 and #$07
  regs.cmp(0x04); m.step(0x2aa4, 2);                                                    // 2aa2 cmp #$04
  if (regs.fNZ) { m.step(0x2ac7, 3); return m.call(0x2ac7); }                           // 2aa4 bne $2ac7
  m.step(0x2aa6, 2); return m.call(0x2aa6);                                             // 2aa4 bne (fall -> loc_2aa6)
}
