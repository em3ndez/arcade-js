// SPDX-License-Identifier: GPL-3.0-only
// loc_28bf  (ROM 0x28bf-0x2932) -- resets $C2+$88 & the $04xx-$07xx object pages, then walks a 46-step
// column sweep building the $8D/$8E pointer from $100A+$8B, seeding the $3F^$EF grid cell and bumping
// $D7+$88 per empty cell. NO RTS: falls through to loc_2932 when the $8F counter underflows.
export function loc_28bf(m) {
  const { regs, mem } = m;
  regs.a = 0x0f; regs.setNZ(regs.a); m.step(0x28c1, 2);
  mem.write8(0x1404, regs.a); m.step(0x28c4, 4);
  regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x28c6, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x28c8, 2);
  mem.write8((0x00c2 + regs.x) & 0xff, regs.a); m.step(0x28ca, 4);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0x28cb, 2);
  m.push16(0x28cd); m.step(0x28ce, 6); m.call(0x2656);
  regs.x = 0x00; regs.setNZ(regs.x); m.step(0x28d0, 2);
  regs.a = regs.x; regs.setNZ(regs.a); m.step(0x28d1, 2);
  while (true) {
    mem.write8((0x0400 + regs.x) & 0xffff, regs.a); m.step(0x28d4, 5);
    mem.write8((0x0500 + regs.x) & 0xffff, regs.a); m.step(0x28d7, 5);
    mem.write8((0x0600 + regs.x) & 0xffff, regs.a); m.step(0x28da, 5);
    mem.write8((0x0700 + regs.x) & 0xffff, regs.a); m.step(0x28dd, 5);
    regs.x = regs.inc8(regs.x); m.step(0x28de, 2);
    if (regs.fNZ) { m.step(0x28d1, 3); continue; }                     // 28de bne $28d1
    m.step(0x28e0, 2); break;                                          // 28de bne $28d1 (fall)
  }
  regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x28e2, 3);
  mem.write8((0x00d7 + regs.x) & 0xff, regs.a); m.step(0x28e4, 4);
  regs.x = 0x1b; regs.setNZ(regs.x); m.step(0x28e6, 2);
  mem.write8(0x008b, regs.x); m.step(0x28e8, 3);
  regs.x = 0x2d; regs.setNZ(regs.x); m.step(0x28ea, 2);
  while (true) {
    regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x28ed, 4); // 28ea lda $100a (loopB top)
    regs.and(0xe0); m.step(0x28ef, 2);
    regs.ora(mem.read8(0x008b)); m.step(0x28f1, 3);
    mem.write8(0x008d, regs.a); m.step(0x28f3, 3);
    regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x28f6, 4);
    regs.and(0x03); m.step(0x28f8, 2);
    regs.ora(0x04); m.step(0x28fa, 2);
    mem.write8(0x008e, regs.a); m.step(0x28fc, 3);                      // 28fa sta $8e
    mem.write8(0x008f, regs.x); m.step(0x28fe, 3);                      // 28fc stx $8f
    regs.y = 0x00; regs.setNZ(regs.y); m.step(0x2900, 2);              // 28fe ldy #$00
    regs.a = mem.read8(0x008d); regs.setNZ(regs.a); m.step(0x2902, 3); // 2900 lda $8d
    regs.and(0x1f); m.step(0x2904, 2);                                 // 2902 and #$1f
    regs.x = mem.read8(0x00ef); regs.setNZ(regs.x); m.step(0x2906, 3); // 2904 ldx $ef
    let go2912 = false;
    if (regs.fZ) {
      m.step(0x290e, 3);                                              // 2906 beq $290e
      regs.cmp(0x0c); m.step(0x2910, 2);                              // 290e cmp #$0c
      if (regs.fC) { m.step(0x291a, 3); }                             // 2910 bcs $291a
      else { m.step(0x2912, 2); go2912 = true; }                     // 2910 bcs $291a (fall)
    } else {
      m.step(0x2908, 2);                                             // 2906 beq $290e (fall)
      regs.cmp(0x14); m.step(0x290a, 2);                              // 2908 cmp #$14
      if (regs.fNC) { m.step(0x291a, 3); }                            // 290a bcc $291a
      else {
        m.step(0x290c, 2);                                          // 290a bcc $291a (fall)
        m.step(0x2912, 3); go2912 = true;                            // 290c bcs $2912
      }
    }
    if (go2912) {
      { const ptr = mem.read16(0x008d); const ea = (ptr + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a); m.step(0x2914, (ptr & 0xff00) !== (ea & 0xff00) ? 6 : 5); } // 2912 lda ($8d),y
      if (regs.fNZ) { m.step(0x291a, 3); }                            // 2914 bne $291a
      else {
        m.step(0x2916, 2);                                          // 2914 bne $291a (fall)
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2918, 3); // 2916 ldx $88
        mem.write8((0x00d7 + regs.x) & 0xff, regs.inc8(mem.read8((0x00d7 + regs.x) & 0xff))); m.step(0x291a, 6); // 2918 inc $d7,x
      }
    }
    regs.a = 0x3f; regs.setNZ(regs.a); m.step(0x291c, 2);              // 291a lda #$3f
    regs.eor(mem.read8(0x00ef)); m.step(0x291e, 3);                    // 291c eor $ef
    mem.write8((mem.read16(0x008d) + regs.y) & 0xffff, regs.a); m.step(0x2920, 6); // 291e sta ($8d),y
    regs.a = mem.read8(0x008b); regs.setNZ(regs.a); m.step(0x2922, 3); // 2920 lda $8b
    regs.sec(); m.step(0x2923, 2);                                     // 2922 sec
    regs.sbc(0x01); m.step(0x2925, 2);                                 // 2923 sbc #$01
    regs.cmp(0x02); m.step(0x2927, 2);                                 // 2925 cmp #$02
    if (regs.fC) { m.step(0x292b, 3); }                                // 2927 bcs $292b
    else {
      m.step(0x2929, 2);                                             // 2927 bcs $292b (fall)
      regs.a = 0x1b; regs.setNZ(regs.a); m.step(0x292b, 2);            // 2929 lda #$1b
    }
    mem.write8(0x008b, regs.a); m.step(0x292d, 3);                      // 292b sta $8b
    regs.x = mem.read8(0x008f); regs.setNZ(regs.x); m.step(0x292f, 3); // 292d ldx $8f
    regs.x = regs.dec8(regs.x); m.step(0x2930, 2);                     // 292f dex
    if (regs.fPl) { m.step(0x28ea, 4); continue; }                     // 2930 bpl $28ea
    m.step(0x2932, 2); break;                                          // 2930 bpl $28ea (fall -> loc_2932)
  }
  return m.call(0x2932);                                               // fall-through into loc_2932
}
