// SPDX-License-Identifier: GPL-3.0-only
// loc_2cef (ROM 0x2cef-0x2d5b) -- scans the ($da/$db),Y cell stream: gated exits via $2d0b (frame/$b7/
// $db/$da checks), else on an in-range [$38,$3f) cell erases it (EOR $ef), seeds $8b/$3f/$6f/$5f/$b2 and
// bumps the 16-bit pointer; loops over cells and falls into loc_2d5c only if the pointer high byte wraps.
export function loc_2cef(m) {
  const { regs, mem } = m;
  let label = 0x2cef;
  for (;;) {
    switch (label) {
      case 0x2cef: {
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x2cf1, 2);
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x2cf3, 3);         // 2cf1 lda $00
        regs.and(0x07); m.step(0x2cf5, 2);
        if (regs.fNZ) { m.step(0x2d0b, 4); label = 0x2d0b; continue; }             // 2cf5 bne $2d0b
        m.step(0x2cf7, 2);                                                         // 2cf5 bne (fall)
        regs.a = mem.read8(0x00b7); regs.setNZ(regs.a); m.step(0x2cf9, 3);         // 2cf7 lda $b7
        if (regs.fNZ) { m.step(0x2d0b, 4); label = 0x2d0b; continue; }             // 2cf9 bne $2d0b
        m.step(0x2cfb, 2);                                                         // 2cf9 bne (fall)
        label = 0x2cfb; continue;
      }
      case 0x2cfb: {
        regs.a = mem.read8(0x00db); regs.setNZ(regs.a); m.step(0x2cfd, 3);         // 2cfb lda $db
        if (regs.fZ) { m.step(0x2d0b, 4); label = 0x2d0b; continue; }              // 2cfd beq $2d0b
        m.step(0x2cff, 2);                                                         // 2cfd beq (fall)
        regs.cmp(0x07); m.step(0x2d01, 2);
        if (regs.fNZ) { m.step(0x2d0c, 3); label = 0x2d0c; continue; }             // 2d01 bne $2d0c
        m.step(0x2d03, 2);                                                         // 2d01 bne (fall)
        regs.a = mem.read8(0x00da); regs.setNZ(regs.a); m.step(0x2d05, 3);         // 2d03 lda $da
        regs.cmp(0xc0); m.step(0x2d07, 2);
        if (regs.fNC) { m.step(0x2d0c, 3); label = 0x2d0c; continue; }             // 2d07 bcc $2d0c
        m.step(0x2d09, 2);                                                         // 2d07 bcc (fall)
        mem.write8(0x00db, regs.y); m.step(0x2d0b, 3);                             // 2d09 sty $db
        label = 0x2d0b; continue;
      }
      case 0x2d0b: {
        return m.ret(6);                                                           // 2d0b rts
      }
      case 0x2d0c: {
        const base0 = mem.read16(0x00da); const addr0 = (base0 + regs.y) & 0xffff;
        regs.a = mem.read8(addr0); regs.setNZ(regs.a);
        m.step(0x2d0e, (base0 & 0xff00) !== (addr0 & 0xff00) ? 6 : 5);             // 2d0c lda ($da),y
        regs.and(0x3f); m.step(0x2d10, 2);
        regs.cmp(0x38); m.step(0x2d12, 2);
        if (regs.fNC) { m.step(0x2d54, 3); label = 0x2d54; continue; }             // 2d12 bcc $2d54
        m.step(0x2d14, 2);                                                         // 2d12 bcc (fall)
        regs.cmp(0x3f); m.step(0x2d16, 2);
        if (regs.fC) { m.step(0x2d54, 3); label = 0x2d54; continue; }              // 2d16 bcs $2d54
        m.step(0x2d18, 2);                                                         // 2d16 bcs (fall)
        regs.a = 0x3f; regs.setNZ(regs.a); m.step(0x2d1a, 2);
        regs.eor(mem.read8(0x00ef)); m.step(0x2d1c, 3);                            // 2d1a eor $ef
        mem.write8((mem.read16(0x00da) + regs.y) & 0xffff, regs.a); m.step(0x2d1e, 6); // 2d1c sta ($da),y
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2d20, 2);
        mem.write8(0x008b, regs.a); m.step(0x2d22, 3);                            // 2d20 sta $8b
        regs.a = 0x05; regs.setNZ(regs.a); m.step(0x2d24, 2);
        m.step(0x2d27, 6); m.call(0x2db6);                                        // 2d24 jsr $2db6
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0x2d29, 2);
        mem.write8(0x003f, regs.a); m.step(0x2d2b, 3);                            // 2d29 sta $3f
        regs.a = mem.read8(0x00db); regs.setNZ(regs.a); m.step(0x2d2d, 3);        // 2d2b lda $db
        mem.write8(0x008b, regs.a); m.step(0x2d2f, 3);                            // 2d2d sta $8b
        regs.a = mem.read8(0x00da); regs.setNZ(regs.a); m.step(0x2d31, 3);        // 2d2f lda $da
        regs.a = regs.asl(regs.a); m.step(0x2d32, 2);
        mem.write8(0x008b, regs.rol(mem.read8(0x008b))); m.step(0x2d34, 5);
        regs.a = regs.asl(regs.a); m.step(0x2d35, 2);
        mem.write8(0x008b, regs.rol(mem.read8(0x008b))); m.step(0x2d37, 5);
        regs.a = regs.asl(regs.a); m.step(0x2d38, 2);
        mem.write8(0x008b, regs.rol(mem.read8(0x008b))); m.step(0x2d3a, 5);
        mem.write8(0x006f, regs.a); m.step(0x2d3c, 3);                            // 2d3a sta $6f
        regs.a = mem.read8(0x008b); regs.setNZ(regs.a); m.step(0x2d3e, 3);        // 2d3c lda $8b
        regs.and(0x1f); m.step(0x2d40, 2);
        regs.eor(0x1f); m.step(0x2d42, 2);
        regs.a = regs.asl(regs.a); m.step(0x2d43, 2);
        regs.a = regs.asl(regs.a); m.step(0x2d44, 2);
        regs.a = regs.asl(regs.a); m.step(0x2d45, 2);
        regs.sbc(0x03); m.step(0x2d47, 2);                                        // 2d45 sbc #$03
        mem.write8(0x005f, regs.a); m.step(0x2d49, 3);                            // 2d47 sta $5f
        mem.write8(0x00da, regs.inc8(mem.read8(0x00da))); m.step(0x2d4b, 5);      // 2d49 inc $da
        if (regs.fNZ) { m.step(0x2d4f, 3); label = 0x2d4f; continue; }            // 2d4b bne $2d4f
        m.step(0x2d4d, 2);                                                        // 2d4b bne (fall)
        mem.write8(0x00db, regs.inc8(mem.read8(0x00db))); m.step(0x2d4f, 5);      // 2d4d inc $db
        label = 0x2d4f; continue;
      }
      case 0x2d4f: {
        regs.a = 0x13; regs.setNZ(regs.a); m.step(0x2d51, 2);
        mem.write8(0x00b2, regs.a); m.step(0x2d53, 3);                            // 2d51 sta $b2
        return m.ret(6);                                                          // 2d53 rts
      }
      case 0x2d54: {
        mem.write8(0x00da, regs.inc8(mem.read8(0x00da))); m.step(0x2d56, 5);      // 2d54 inc $da
        if (regs.fNZ) { m.step(0x2cfb, 4); label = 0x2cfb; continue; }            // 2d56 bne $2cfb
        m.step(0x2d58, 2);                                                        // 2d56 bne (fall)
        mem.write8(0x00db, regs.inc8(mem.read8(0x00db))); m.step(0x2d5a, 5);      // 2d58 inc $db
        if (regs.fNZ) { m.step(0x2d0c, 3); label = 0x2d0c; continue; }            // 2d5a bne $2d0c
        m.step(0x2d5c, 2); return m.call(0x2d5c);                                 // 2d5a bne (fall -> loc_2d5c)
      }
    }
  }
}
