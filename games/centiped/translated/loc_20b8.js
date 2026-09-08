// SPDX-License-Identifier: GPL-3.0-only
// loc_20b8  (ROM 0x20b8-0x20e8) -- stashes A into $70, EORs $f0 and range-gates; when in range and the
// $2c96 collision test and $00/$100a low-bit timers all pass, computes an index and calls $2c2b then $2ba8.
export function loc_20b8(m) {
  const { regs, mem } = m;
  mem.write8(0x0070, regs.a); m.step(0x20ba, 3);                                // 20b8 sta $70
  regs.eor(mem.read8(0x00f0)); m.step(0x20bc, 3);                               // 20ba eor $f0
  regs.cmp(0x04); m.step(0x20be, 2);                                            // 20bc cmp #$04
  if (regs.fNC) {                                                              // 20be bcc $20e4 (taken)
    m.step(0x20e4, 3);
    m.push16(0x20e6); m.step(0x20e7, 6); m.call(0x20e8);                                          // 20e4 jsr $20e8
    return m.ret(6);                                                            // 20e7 rts
  }
  m.step(0x20c0, 2);
  regs.x = 0x0c; regs.setNZ(regs.x); m.step(0x20c2, 2);                         // 20c0 ldx #$0c
  m.push16(0x20c4); m.step(0x20c5, 6); m.call(0x2c96);                                            // 20c2 jsr $2c96
  if (regs.fNC) {  // 20c5 bcc $20e3 (taken -> rts)
    m.step(0x20e3, 3); return m.ret(6);
  }
  m.step(0x20c7, 2);
  regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x20c9, 3);            // 20c7 lda $00
  regs.and(0x03); m.step(0x20cb, 2);                                            // 20c9 and #$03
  if (regs.fNZ) {  // 20cb bne $20e3 (taken -> rts)
    m.step(0x20e3, 3); return m.ret(6);
  }
  m.step(0x20cd, 2);
  regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x20d0, 4);            // 20cd lda $100a
  regs.and(0x03); m.step(0x20d2, 2);                                            // 20d0 and #$03
  if (regs.fNZ) {  // 20d2 bne $20e3 (taken -> rts)
    m.step(0x20e3, 3); return m.ret(6);
  }
  m.step(0x20d4, 2);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0x20d6, 2);                         // 20d4 lda #$04
  regs.eor(mem.read8(0x00f3)); m.step(0x20d8, 3);                              // 20d6 eor $f3
  regs.clc(); m.step(0x20d9, 2);                                                // 20d8 clc
  regs.adc(mem.read8(0x0070)); m.step(0x20db, 3);                              // 20d9 adc $70
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x20dd, 2);                         // 20db ldy #$00
  m.push16(0x20df); m.step(0x20e0, 6); m.call(0x2c2b);                                            // 20dd jsr $2c2b
  m.push16(0x20e2); m.step(0x20e3, 6); m.call(0x2ba8);                                            // 20e0 jsr $2ba8
  return m.ret(6);                                                              // 20e3 rts
}
