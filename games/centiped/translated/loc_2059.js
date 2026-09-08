// SPDX-License-Identifier: GPL-3.0-only
// loc_2059  (ROM 0x2059-0x20b8) -- guard on $43 then range compares of $40/$70/$9a,x/$ab,x; advances the $40
// colour byte, sets $8b, adds/subtracts $80 into $70 and tail-calls loc_20b8 (early exits RTS via 0x20e3).
export function loc_2059(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x205b, 3);   // 2059 lda $43
  regs.and(0xaf); m.step(0x205d, 2);
  if (regs.fNZ) { m.step(0x2067, 3); return m.ret(6); }               // 205d bne $2067 (taken -> 2067 rts)
  m.step(0x205f, 2);                                                   // 205d bne $2067 (fall)
  regs.a = mem.read8(0x0040); regs.setNZ(regs.a); m.step(0x2061, 3);  // 205f lda $40
  regs.eor(mem.read8(0x00ef)); m.step(0x2063, 3);
  regs.cmp(0x20); m.step(0x2065, 2);
  if (regs.fNC) {
    m.step(0x2068, 3);                                                // 2065 bcc $2068 (taken)
  } else {
    m.step(0x2067, 2); return m.ret(6);                               // 2065 bcc $2068 (fall -> 2067 rts)
  }
  regs.a = mem.read8(0x0070); regs.setNZ(regs.a); m.step(0x206a, 3);  // 2068 lda $70
  regs.eor(mem.read8(0x00f0)); m.step(0x206c, 3);
  regs.cmp(0xf8); m.step(0x206e, 2);
  if (regs.fNC) {
    m.step(0x2090, 3);                                                // 206e bcc $2090 (taken)
  } else {
    m.step(0x2070, 2);                                                // 206e bcc $2090 (fall)
    regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2072, 3); // 2070 ldx $88
    regs.a = mem.read8((0x009a + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2074, 4);
    regs.cmp(0x0c); m.step(0x2076, 2);
    if (regs.fC) { m.step(0x20e3, 3); return m.ret(6); }              // 2076 bcs $20e3 (taken -> 20e3 rts in loc_20b8)
    m.step(0x2078, 2);                                                // 2076 bcs $20e3 (fall)
    regs.a = mem.read8((0x00ab + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x207a, 4);
    regs.cmp(0x02); m.step(0x207c, 2);
    regs.y = 0x05; regs.setNZ(regs.y); m.step(0x207e, 2);            // 207c ldy #$05
    if (regs.fNC) {
      m.step(0x2082, 3);                                              // 207e bcc $2082 (taken)
    } else {
      m.step(0x2080, 2);                                              // 207e bcc $2082 (fall)
      regs.y = 0x09; regs.setNZ(regs.y); m.step(0x2082, 2);          // 2080 ldy #$09
    }
    regs.cmp(0x12); m.step(0x2084, 2);                                // 2082 cmp #$12
    if (regs.fNC) {
      m.step(0x208b, 3);                                              // 2084 bcc $208b (taken)
    } else {
      m.step(0x2086, 2);                                              // 2084 bcc $208b (fall)
      regs.a = regs.lsr(regs.a); m.step(0x2087, 2);
      regs.clc(); m.step(0x2088, 2);
      regs.adc(0x06); m.step(0x208a, 2);
      regs.y = regs.a; regs.setNZ(regs.y); m.step(0x208b, 2);        // 208a tay
    }
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0x208c, 2);          // 208b tya
    regs.cmp(mem.read8((0x00d7 + regs.x) & 0xff)); m.step(0x208e, 4); // 208c cmp $d7,x
    if (regs.fNC) { m.step(0x20e3, 3); return m.ret(6); }            // 208e bcc $20e3 (taken -> 20e3 rts in loc_20b8)
    m.step(0x2090, 2);                                                // 208e bcc $20e3 (fall)
  }
  regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x2092, 3);
  regs.and(0x03); m.step(0x2094, 2);
  if (regs.fNZ) {
    m.step(0x20a5, 3);                                                // 2094 bne $20a5 (taken)
  } else {
    m.step(0x2096, 2);                                                // 2094 bne $20a5 (fall)
    mem.write8(0x0040, regs.inc8(mem.read8(0x0040))); m.step(0x2098, 5); // 2096 inc $40
    regs.a = mem.read8(0x0040); regs.setNZ(regs.a); m.step(0x209a, 3); // 2098 lda $40
    regs.clc(); m.step(0x209b, 2);
    regs.adc(0x01); m.step(0x209d, 2);
    regs.and(0x03); m.step(0x209f, 2);
    regs.ora(0x1c); m.step(0x20a1, 2);
    regs.eor(mem.read8(0x00ef)); m.step(0x20a3, 3);
    mem.write8(0x0040, regs.a); m.step(0x20a5, 3);                    // 20a3 sta $40
  }
  regs.a = mem.read8(0x0060); regs.setNZ(regs.a); m.step(0x20a7, 3);  // 20a5 lda $60
  mem.write8(0x008b, regs.a); m.step(0x20a9, 3);                      // 20a7 sta $8b
  regs.a = mem.read8(0x0070); regs.setNZ(regs.a); m.step(0x20ab, 3);  // 20a9 lda $70
  regs.y = mem.read8(0x00ef); regs.setNZ(regs.y); m.step(0x20ad, 3);  // 20ab ldy $ef
  if (regs.fZ) {
    m.step(0x20b5, 3);                                                // 20ad beq $20b5 (taken)
    regs.sec(); m.step(0x20b6, 2);                                    // 20b5 sec
    regs.sbc(mem.read8(0x0080)); m.step(0x20b8, 3);                   // 20b6 sbc $80 (fall into loc_20b8)
    return m.call(0x20b8);
  }
  m.step(0x20af, 2);                                                  // 20ad beq $20b5 (fall)
  regs.clc(); m.step(0x20b0, 2);                                      // 20af clc
  regs.adc(mem.read8(0x0080)); m.step(0x20b2, 3);                     // 20b0 adc $80
  m.step(0x20b8, 3);                                                  // 20b2 jmp $20b8 (loc_20b8)
  return m.call(0x20b8);
}
