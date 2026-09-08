// SPDX-License-Identifier: GPL-3.0-only
// loc_3068 (ROM 0x3068-0x3149) -- per-frame audio-channel updater writing the $1000 sound regs from $b2-$b8 timers; RTS.
export function loc_3068(m) {
  const { regs, mem } = m;
  let blk = 0x3068;
  for (;;) {
    switch (blk) {
      case 0x3068: {
        regs.x = mem.read8(0x0086); regs.setNZ(regs.x); m.step(0x306a, 3); // 3068 ldx $86
        if (regs.fPl) { m.step(0x307b, 3); blk = 0x307b; break; }          // 306a bpl $307b
        m.step(0x306c, 2); blk = 0x306c; break;
      }
      case 0x306c: {
        regs.x = 0x00; regs.setNZ(regs.x); m.step(0x306e, 2);   // 306c ldx #$00
        mem.write8(0x1001, regs.x); m.step(0x3071, 4);          // 306e stx $1001
        mem.write8(0x1003, regs.x); m.step(0x3074, 4);          // 3071 stx $1003
        mem.write8(0x1005, regs.x); m.step(0x3077, 4);          // 3074 stx $1005
        mem.write8(0x1007, regs.x); m.step(0x307a, 4);          // 3077 stx $1007
        return m.ret(6);                                        // 307a rts
      }
      case 0x307b: {
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x307d, 3); // 307b lda $00
        regs.a = regs.lsr(regs.a); m.step(0x307e, 2);           // 307d lsr a
        if (regs.fNC) { m.step(0x3099, 3); blk = 0x3099; break; } // 307e bcc $3099
        m.step(0x3080, 2); blk = 0x3080; break;
      }
      case 0x3080: {
        regs.y = mem.read8(0x00b5); regs.setNZ(regs.y); m.step(0x3082, 3); // 3080 ldy $b5
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x3083, 2); // 3082 tya
        if (regs.fZ) { m.step(0x3096, 3); blk = 0x3096; break; } // 3083 beq $3096
        m.step(0x3085, 2); blk = 0x3085; break;
      }
      case 0x3085: {
        mem.write8(0x00b5, regs.dec8(mem.read8(0x00b5))); m.step(0x3087, 5); // 3085 dec $b5
        if (regs.fNZ) { m.step(0x308d, 3); blk = 0x308d; break; } // 3087 bne $308d
        m.step(0x3089, 2); blk = 0x3089; break;
      }
      case 0x3089: {
        regs.a = 0x14; regs.setNZ(regs.a); m.step(0x308b, 2);   // 3089 lda #$14
        mem.write8(0x00b5, regs.a); m.step(0x308d, 3);          // 308b sta $b5
        blk = 0x308d; break;
      }
      case 0x308d: {
        { const base = 0x3187; const addr = (base + regs.y) & 0xffff;
          const cross = (base & 0xff00) !== (addr & 0xff00) ? 1 : 0;
          regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x3090, 4 + cross); } // 308d lda $3187,y
        mem.write8(0x1006, regs.a); m.step(0x3093, 4);          // 3090 sta $1006
        { const base = 0x319b; const addr = (base + regs.y) & 0xffff;
          const cross = (base & 0xff00) !== (addr & 0xff00) ? 1 : 0;
          regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x3096, 4 + cross); } // 3093 lda $319b,y
        blk = 0x3096; break;
      }
      case 0x3096: {
        mem.write8(0x1007, regs.a); m.step(0x3099, 4);          // 3096 sta $1007
        blk = 0x3099; break;
      }
      case 0x3099: {
        regs.y = mem.read8(0x00b4); regs.setNZ(regs.y); m.step(0x309b, 3); // 3099 ldy $b4
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x309c, 2); // 309b tya
        if (regs.fZ) { m.step(0x30a8, 3); blk = 0x30a8; break; } // 309c beq $30a8
        m.step(0x309e, 2); blk = 0x309e; break;
      }
      case 0x309e: {
        mem.write8(0x00b4, regs.dec8(mem.read8(0x00b4))); m.step(0x30a0, 5); // 309e dec $b4
        { const base = 0x317c; const addr = (base + regs.y) & 0xffff;
          const cross = (base & 0xff00) !== (addr & 0xff00) ? 1 : 0;
          regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x30a3, 4 + cross); } // 30a0 lda $317c,y
        mem.write8(0x1004, regs.a); m.step(0x30a6, 4);          // 30a3 sta $1004
        regs.a = 0x64; regs.setNZ(regs.a); m.step(0x30a8, 2);   // 30a6 lda #$64
        blk = 0x30a8; break;
      }
      case 0x30a8: {
        mem.write8(0x1005, regs.a); m.step(0x30ab, 4);          // 30a8 sta $1005
        regs.y = mem.read8(0x00b6); regs.setNZ(regs.y); m.step(0x30ad, 3); // 30ab ldy $b6
        if (regs.fZ) { m.step(0x30d7, 3); blk = 0x30d7; break; } // 30ad beq $30d7
        m.step(0x30af, 2); blk = 0x30af; break;
      }
      case 0x30af: {
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x30b1, 3); // 30af lda $00
        regs.and(0x07); m.step(0x30b3, 2);                      // 30b1 and #$07
        if (regs.fNZ) { m.step(0x3128, 4); blk = 0x3128; break; } // 30b3 bne $3128
        m.step(0x30b5, 2); blk = 0x30b5; break;
      }
      case 0x30b5: {
        mem.write8(0x00b6, regs.dec8(mem.read8(0x00b6))); m.step(0x30b7, 5); // 30b5 dec $b6
        regs.y = regs.dec8(regs.y); m.step(0x30b8, 2);          // 30b7 dey
        if (regs.fZ) { m.step(0x30d7, 3); blk = 0x30d7; break; } // 30b8 beq $30d7
        m.step(0x30ba, 2); blk = 0x30ba; break;
      }
      case 0x30ba: {
        { const base = 0x31af; const addr = (base + regs.y) & 0xffff;
          const cross = (base & 0xff00) !== (addr & 0xff00) ? 1 : 0;
          regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x30bd, 4 + cross); } // 30ba lda $31af,y
        mem.write8(0x1002, regs.a); m.step(0x30c0, 4);          // 30bd sta $1002
        regs.a = 0xa4; regs.setNZ(regs.a); m.step(0x30c2, 2);   // 30c0 lda #$a4
        if (regs.fNZ) { m.step(0x3125, 4); blk = 0x3125; break; } // 30c2 bne $3125
        m.step(0x30c4, 2); blk = 0x30c4; break;
      }
      case 0x30c4: {
        regs.y = mem.read8(0x00b8); regs.setNZ(regs.y); m.step(0x30c6, 3); // 30c4 ldy $b8
        regs.y = regs.dec8(regs.y); m.step(0x30c7, 2);          // 30c6 dey
        if (regs.fNZ) { m.step(0x30cb, 3); blk = 0x30cb; break; } // 30c7 bne $30cb
        m.step(0x30c9, 2); blk = 0x30c9; break;
      }
      case 0x30c9: {
        regs.y = 0x14; regs.setNZ(regs.y); m.step(0x30cb, 2);   // 30c9 ldy #$14
        blk = 0x30cb; break;
      }
      case 0x30cb: {
        mem.write8(0x00b8, regs.y); m.step(0x30cd, 3);          // 30cb sty $b8
        { const base = 0x31c0; const addr = (base + regs.y) & 0xffff;
          const cross = (base & 0xff00) !== (addr & 0xff00) ? 1 : 0;
          regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x30d0, 4 + cross); } // 30cd lda $31c0,y
        mem.write8(0x1002, regs.a); m.step(0x30d3, 4);          // 30d0 sta $1002
        regs.a = 0xa4; regs.setNZ(regs.a); m.step(0x30d5, 2);   // 30d3 lda #$a4
        if (regs.fNZ) { m.step(0x3125, 4); blk = 0x3125; break; } // 30d5 bne $3125
        m.step(0x30d7, 2); blk = 0x30d7; break;
      }
      case 0x30d7: {
        regs.a = mem.read8(0x0070); regs.setNZ(regs.a); m.step(0x30d9, 3); // 30d7 lda $70
        regs.eor(mem.read8(0x00f0)); m.step(0x30db, 3);         // 30d9 eor $f0
        regs.cmp(0xf8); m.step(0x30dd, 2);                      // 30db cmp #$f8
        if (regs.fC) { m.step(0x3115, 4); blk = 0x3115; break; } // 30dd bcs $3115
        m.step(0x30df, 2); blk = 0x30df; break;
      }
      case 0x30df: {
        regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x30e1, 3); // 30df lda $43
        regs.and(0xaf); m.step(0x30e3, 2);                      // 30e1 and #$af
        if (regs.fNZ) { m.step(0x3115, 4); blk = 0x3115; break; } // 30e3 bne $3115
        m.step(0x30e5, 2); blk = 0x30e5; break;
      }
      case 0x30e5: {
        regs.a = mem.read8(0x0040); regs.setNZ(regs.a); m.step(0x30e7, 3); // 30e5 lda $40
        regs.eor(mem.read8(0x00ef)); m.step(0x30e9, 3);         // 30e7 eor $ef
        regs.cmp(0x34); m.step(0x30eb, 2);                      // 30e9 cmp #$34
        if (regs.fC) { m.step(0x3115, 4); blk = 0x3115; break; } // 30eb bcs $3115
        m.step(0x30ed, 2); blk = 0x30ed; break;
      }
      case 0x30ed: {
        regs.cmp(0x20); m.step(0x30ef, 2);                      // 30ed cmp #$20
        if (regs.fC) { m.step(0x30c4, 3); blk = 0x30c4; break; } // 30ef bcs $30c4
        m.step(0x30f1, 2); blk = 0x30f1; break;
      }
      case 0x30f1: {
        regs.a = mem.read8(0x0070); regs.setNZ(regs.a); m.step(0x30f3, 3); // 30f1 lda $70
        regs.eor(mem.read8(0x00f4)); m.step(0x30f5, 3);         // 30f3 eor $f4
        regs.a = regs.lsr(regs.a); m.step(0x30f6, 2);           // 30f5 lsr a
        regs.eor(0xff); m.step(0x30f8, 2);                      // 30f6 eor #$ff
        regs.ora(0x80); m.step(0x30fa, 2);                      // 30f8 ora #$80
        mem.write8(0x1002, regs.a); m.step(0x30fd, 4);          // 30fa sta $1002
        regs.a = 0xa4; regs.setNZ(regs.a); m.step(0x30ff, 2);   // 30fd lda #$a4
        if (regs.fNZ) { m.step(0x3125, 3); blk = 0x3125; break; } // 30ff bne $3125
        m.step(0x3101, 2); blk = 0x3101; break;
      }
      case 0x3101: {
        regs.y = mem.read8(0x00b2); regs.setNZ(regs.y); m.step(0x3103, 3); // 3101 ldy $b2
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x3104, 2); // 3103 tya
        if (regs.fZ) { m.step(0x3111, 3); blk = 0x3111; break; } // 3104 beq $3111
        m.step(0x3106, 2); blk = 0x3106; break;
      }
      case 0x3106: {
        mem.write8(0x00b2, regs.dec8(mem.read8(0x00b2))); m.step(0x3108, 5); // 3106 dec $b2
        { const base = 0x3148; const addr = (base + regs.y) & 0xffff;
          const cross = (base & 0xff00) !== (addr & 0xff00) ? 1 : 0;
          regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x310b, 4 + cross); } // 3108 lda $3148,y
        mem.write8(0x1000, regs.a); m.step(0x310e, 4);          // 310b sta $1000
        { const base = 0x315b; const addr = (base + regs.y) & 0xffff;
          const cross = (base & 0xff00) !== (addr & 0xff00) ? 1 : 0;
          regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x3111, 4 + cross); } // 310e lda $315b,y
        blk = 0x3111; break;
      }
      case 0x3111: {
        mem.write8(0x1001, regs.a); m.step(0x3114, 4);          // 3111 sta $1001
        return m.ret(6);                                        // 3114 rts
      }
      case 0x3115: {
        regs.y = mem.read8(0x00b3); regs.setNZ(regs.y); m.step(0x3117, 3); // 3115 ldy $b3
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x3118, 2); // 3117 tya
        if (regs.fZ) { m.step(0x3125, 3); blk = 0x3125; break; } // 3118 beq $3125
        m.step(0x311a, 2); blk = 0x311a; break;
      }
      case 0x311a: {
        mem.write8(0x00b3, regs.dec8(mem.read8(0x00b3))); m.step(0x311c, 5); // 311a dec $b3
        { const base = 0x316e; const addr = (base + regs.y) & 0xffff;
          const cross = (base & 0xff00) !== (addr & 0xff00) ? 1 : 0;
          regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x311f, 4 + cross); } // 311c lda $316e,y
        mem.write8(0x1002, regs.a); m.step(0x3122, 4);          // 311f sta $1002
        { const base = 0x3175; const addr = (base + regs.y) & 0xffff;
          const cross = (base & 0xff00) !== (addr & 0xff00) ? 1 : 0;
          regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x3125, 4 + cross); } // 3122 lda $3175,y
        blk = 0x3125; break;
      }
      case 0x3125: {
        mem.write8(0x1003, regs.a); m.step(0x3128, 4);          // 3125 sta $1003
        blk = 0x3128; break;
      }
      case 0x3128: {
        regs.y = mem.read8(0x00b7); regs.setNZ(regs.y); m.step(0x312a, 3); // 3128 ldy $b7
        if (regs.fZ) { m.step(0x3101, 3); blk = 0x3101; break; } // 312a beq $3101
        m.step(0x312c, 2); blk = 0x312c; break;
      }
      case 0x312c: {
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x312e, 3); // 312c lda $00
        regs.and(0x03); m.step(0x3130, 2);                      // 312e and #$03
        if (regs.fNZ) { m.step(0x3148, 3); blk = 0x3148; break; } // 3130 bne $3148
        m.step(0x3132, 2); blk = 0x3132; break;
      }
      case 0x3132: {
        mem.write8(0x00b7, regs.dec8(mem.read8(0x00b7))); m.step(0x3134, 5); // 3132 dec $b7
        regs.y = regs.dec8(regs.y); m.step(0x3135, 2);          // 3134 dey
        if (regs.fZ) { m.step(0x3148, 3); blk = 0x3148; break; } // 3135 beq $3148
        m.step(0x3137, 2); blk = 0x3137; break;
      }
      case 0x3137: {
        { const base = 0x3148; const addr = (base + regs.y) & 0xffff;
          const cross = (base & 0xff00) !== (addr & 0xff00) ? 1 : 0;
          regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x313a, 4 + cross); } // 3137 lda $3148,y
        mem.write8(0x1000, regs.a); m.step(0x313d, 4);          // 313a sta $1000
        { const base = 0x315b; const addr = (base + regs.y) & 0xffff;
          const cross = (base & 0xff00) !== (addr & 0xff00) ? 1 : 0;
          regs.a = mem.read8(addr); regs.setNZ(regs.a); m.step(0x3140, 4 + cross); } // 313d lda $315b,y
        if (regs.fZ) { m.step(0x3145, 3); blk = 0x3145; break; } // 3140 beq $3145
        m.step(0x3142, 2); blk = 0x3142; break;
      }
      case 0x3142: {
        regs.clc(); m.step(0x3143, 2);                          // 3142 clc
        regs.adc(0x02); m.step(0x3145, 2);                      // 3143 adc #$02
        blk = 0x3145; break;
      }
      case 0x3145: {
        mem.write8(0x1001, regs.a); m.step(0x3148, 4);          // 3145 sta $1001
        blk = 0x3148; break;
      }
      case 0x3148: {
        return m.ret(6);                                        // 3148 rts
      }
    }
  }
}
