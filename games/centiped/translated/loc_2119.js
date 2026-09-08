// SPDX-License-Identifier: GPL-3.0-only
// loc_2119  (ROM 0x2119-0x218d) -- when $86 flags active: primes $91-$94, runs $3825/$37d5, gates on
// $00 bit7 and $43, clamps $53/$83 targets via $2aeb/$2b24, calls $2b60 and EOR-checksums $2120..$2133 into $fe.
export function loc_2119(m) {
  const { regs, mem } = m;
  let label = 0x2119;
  for (;;) {
    switch (label) {
      case 0x2119: {
        regs.a = mem.read8(0x0086); regs.setNZ(regs.a); m.step(0x211b, 3);        // 2119 lda $86
        if (regs.fPl) { m.step(0x218c, 3); label = 0x218c; continue; }            // 211b bpl $218c
        m.step(0x211d, 2);
        m.step(0x2120, 6); m.call(0x2195);                                        // 211d jsr $2195
        regs.a = 0x03; regs.setNZ(regs.a); m.step(0x2122, 2);                     // 2120 lda #$03
        mem.write8(0x0093, regs.a); m.step(0x2124, 3);
        regs.a = 0x20; regs.setNZ(regs.a); m.step(0x2126, 2);                     // 2124 lda #$20
        mem.write8(0x0094, regs.a); m.step(0x2128, 3);
        regs.a = 0x40; regs.setNZ(regs.a); m.step(0x212a, 2);                     // 2128 lda #$40
        mem.write8(0x0091, regs.a); m.step(0x212c, 3);
        regs.a = 0x05; regs.setNZ(regs.a); m.step(0x212e, 2);                     // 212c lda #$05
        mem.write8(0x0092, regs.a); m.step(0x2130, 3);
        m.step(0x2133, 6); m.call(0x3825);                                        // 2130 jsr $3825
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x2135, 3);        // 2133 lda $00
        if (regs.fNZ) { m.step(0x213c, 3); label = 0x213c; continue; }            // 2135 bne $213c
        m.step(0x2137, 2);
        regs.a = 0x84; regs.setNZ(regs.a); m.step(0x2139, 2);                     // 2137 lda #$84
        m.step(0x213c, 6); m.call(0x37d5);                                        // 2139 jsr $37d5
        label = 0x213c; continue;
      }
      case 0x213c: {
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x213e, 3);        // 213c lda $00
        regs.x = mem.read8(0x0600); regs.setNZ(regs.x); m.step(0x2141, 4);        // 213e ldx $0600
        mem.write8(0x00ff, regs.x); m.step(0x2143, 3);
        regs.and(0x80); m.step(0x2145, 2);                                        // 2143 and #$80
        if (regs.fNZ) { m.step(0x218c, 3); label = 0x218c; continue; }            // 2145 bne $218c
        m.step(0x2147, 2);
        regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x2149, 3);        // 2147 lda $43
        regs.and(0xaf); m.step(0x214b, 2);                                        // 2149 and #$af
        if (regs.fNZ) { m.step(0x217d, 3); label = 0x217d; continue; }            // 214b bne $217d
        m.step(0x214d, 2);
        regs.a = mem.read8(0x0063); regs.setNZ(regs.a); m.step(0x214f, 3);        // 214d lda $63
        regs.y = 0x01; regs.setNZ(regs.y); m.step(0x2151, 2);                     // 214f ldy #$01
        regs.cmp(0x1c); m.step(0x2153, 2);                                        // 2151 cmp #$1c
        if (regs.fNC) { m.step(0x215d, 3); label = 0x215d; continue; }            // 2153 bcc $215d
        m.step(0x2155, 2);
        regs.y = 0xff; regs.setNZ(regs.y); m.step(0x2157, 2);                     // 2155 ldy #$ff
        regs.cmp(0xe4); m.step(0x2159, 2);                                        // 2157 cmp #$e4
        if (regs.fC) { m.step(0x215d, 3); label = 0x215d; continue; }             // 2159 bcs $215d
        m.step(0x215b, 2);
        regs.y = mem.read8(0x0053); regs.setNZ(regs.y); m.step(0x215d, 3);        // 215b ldy $53
        label = 0x215d; continue;
      }
      case 0x215d: {
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x215e, 2);                   // 215d tya
        mem.write8(0x0053, regs.y); m.step(0x2160, 3);
        regs.clc(); m.step(0x2161, 2);                                            // 2160 clc
        m.step(0x2164, 6); m.call(0x2aeb);                                        // 2161 jsr $2aeb
        regs.a = mem.read8(0x0073); regs.setNZ(regs.a); m.step(0x2166, 3);        // 2164 lda $73
        mem.write8(0x008d, regs.a); m.step(0x2168, 3);
        regs.y = 0xff; regs.setNZ(regs.y); m.step(0x216a, 2);                     // 2168 ldy #$ff
        regs.cmp(0x30); m.step(0x216c, 2);                                        // 216a cmp #$30
        if (regs.fC) { m.step(0x2176, 3); label = 0x2176; continue; }            // 216c bcs $2176
        m.step(0x216e, 2);
        regs.y = 0x01; regs.setNZ(regs.y); m.step(0x2170, 2);                     // 216e ldy #$01
        regs.cmp(0x09); m.step(0x2172, 2);                                        // 2170 cmp #$09
        if (regs.fNC) { m.step(0x2176, 3); label = 0x2176; continue; }            // 2172 bcc $2176
        m.step(0x2174, 2);
        regs.y = mem.read8(0x0083); regs.setNZ(regs.y); m.step(0x2176, 3);        // 2174 ldy $83
        label = 0x2176; continue;
      }
      case 0x2176: {
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x2177, 2);                   // 2176 tya
        mem.write8(0x0083, regs.y); m.step(0x2179, 3);
        regs.clc(); m.step(0x217a, 2);                                            // 2179 clc
        m.step(0x217d, 6); m.call(0x2b24);                                        // 217a jsr $2b24
        label = 0x217d; continue;
      }
      case 0x217d: {
        m.step(0x2180, 6); m.call(0x2b60);                                        // 217d jsr $2b60
        regs.x = 0x13; regs.setNZ(regs.x); m.step(0x2182, 2);                     // 2180 ldx #$13
        regs.a = 0xfa; regs.setNZ(regs.a); m.step(0x2184, 2);                     // 2182 lda #$fa
        for (;;) {
          regs.eor(mem.read8((0x2120 + regs.x) & 0xffff)); m.step(0x2187, 4);     // 2184 eor $2120,x
          regs.x = regs.dec8(regs.x); m.step(0x2188, 2);                          // 2187 dex
          if (regs.fPl) { m.step(0x2184, 3); continue; }                         // 2188 bpl $2184
          m.step(0x218a, 2);
          break;
        }
        mem.write8(0x00fe, regs.a); m.step(0x218c, 3);
        label = 0x218c; continue;
      }
      case 0x218c: {
        return m.ret(6);                                                          // 218c rts
      }
    }
  }
}
