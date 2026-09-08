// SPDX-License-Identifier: GPL-3.0-only
// loc_31d5 (ROM 0x31d5-0x3226) -- transposes an 8xN bit block through $8b/$0100 scratch across $33 pages; RTS.
export function loc_31d5(m) {
  const { regs, mem } = m;
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x31d7, 2);
  mem.write8(0x0032, regs.y); m.step(0x31d9, 3);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0x31db, 2);
  mem.write8(0x0033, regs.a); m.step(0x31dd, 3);
  mem.write8(0x008d, regs.y); m.step(0x31df, 3);
  for (;;) {                                                 // outer loop top = 0x31df
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0x31e1, 2);
    mem.write8(0x008b, regs.a); m.step(0x31e3, 3);
    mem.write8(0x008e, regs.y); m.step(0x31e5, 3);           // 31e3 sty $8e
    regs.x = 0x08; regs.setNZ(regs.x); m.step(0x31e7, 2);    // 31e5 ldx #$08
    for (;;) {                                               // inner1 top = 0x31e7
      { const base = mem.read16(0x0032); const addr = (base + regs.y) & 0xffff;
        const cross = (base & 0xff00) !== (addr & 0xff00) ? 1 : 0;
        regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x31e9, 5 + cross); } // 31e7 lda ($32),y
      regs.and(0x3f); m.step(0x31eb, 2);                     // 31e9 and #$3f
      regs.cmp(0x38); m.step(0x31ed, 2);                     // 31eb cmp #$38
      mem.write8(0x008b, regs.rol(mem.read8(0x008b))); m.step(0x31ef, 5); // 31ed rol $8b
      regs.y = regs.inc8(regs.y); m.step(0x31f0, 2);         // 31ef iny
      regs.x = regs.dec8(regs.x); m.step(0x31f1, 2);         // 31f0 dex
      if (regs.fNZ) { m.step(0x31e7, 3); continue; }         // 31f1 bne $31e7
      m.step(0x31f3, 2); break;
    }
    regs.x = mem.read8(0x008d); regs.setNZ(regs.x); m.step(0x31f5, 3); // 31f3 ldx $8d
    { const addr = (0x0100 + regs.x) & 0xffff;
      const cross = (0x0100 & 0xff00) !== (addr & 0xff00) ? 1 : 0;
      regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x31f8, 4 + cross); } // 31f5 lda $0100,x
    mem.write8(0x008d, regs.inc8(mem.read8(0x008d))); m.step(0x31fa, 5); // 31f8 inc $8d
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0x31fb, 2);  // 31fa tay
    regs.a = mem.read8(0x008b); regs.setNZ(regs.a); m.step(0x31fd, 3); // 31fb lda $8b
    mem.write8((0x0100 + regs.x) & 0xffff, regs.a); m.step(0x3200, 5); // 31fd sta $0100,x
    mem.write8(0x008b, regs.y); m.step(0x3202, 3);           // 3200 sty $8b
    regs.y = mem.read8(0x008e); regs.setNZ(regs.y); m.step(0x3204, 3); // 3202 ldy $8e
    regs.x = 0x08; regs.setNZ(regs.x); m.step(0x3206, 2);    // 3204 ldx #$08
    for (;;) {                                               // inner2 top = 0x3206
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3208, 2);  // 3206 lda #$00
      mem.write8(0x008b, regs.rol(mem.read8(0x008b))); m.step(0x320a, 5); // 3208 rol $8b
      if (regs.fNC) {                                        // 320a bcc $3210
        m.step(0x3210, 3);
      } else {
        m.step(0x320c, 2);
        regs.a = 0x3f; regs.setNZ(regs.a); m.step(0x320e, 2); // 320c lda #$3f
        regs.eor(mem.read8(0x00ef)); m.step(0x3210, 3);      // 320e eor $ef
      }
      { const base = mem.read16(0x0032); const addr = (base + regs.y) & 0xffff;
        mem.write8(addr, regs.a); m.step(0x3212, 6); }       // 3210 sta ($32),y
      regs.y = regs.inc8(regs.y); m.step(0x3213, 2);         // 3212 iny
      regs.x = regs.dec8(regs.x); m.step(0x3214, 2);         // 3213 dex
      if (regs.fNZ) { m.step(0x3206, 3); continue; }         // 3214 bne $3206
      m.step(0x3216, 2); break;
    }
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0x3217, 2);  // 3216 tya
    if (regs.fNZ) {                                          // 3217 bne $321b
      m.step(0x321b, 3);
    } else {
      m.step(0x3219, 2);
      mem.write8(0x0033, regs.inc8(mem.read8(0x0033))); m.step(0x321b, 5); // 3219 inc $33
    }
    regs.cpy(0xc0); m.step(0x321d, 2);                       // 321b cpy #$c0
    if (regs.fNZ) { m.step(0x31df, 4); continue; }           // 321d bne $31df
    m.step(0x321f, 2);
    regs.a = mem.read8(0x0033); regs.setNZ(regs.a); m.step(0x3221, 3); // 321f lda $33
    regs.cmp(0x07); m.step(0x3223, 2);                       // 3221 cmp #$07
    if (regs.fNZ) { m.step(0x31df, 4); continue; }           // 3223 bne $31df
    m.step(0x3225, 2);
    break;
  }
  return m.ret(6);                                           // 3225 rts
}
