// SPDX-License-Identifier: GPL-3.0-only
// loc_2202  (ROM 0x2202-0x227f) -- advances the flea/spider column state in $41/$a1/$51/$61/$71/$8b;
// branches out to loc_22fa, tail-jumps/falls into loc_2280, and remaps $81 via loc_382d.
export function loc_2202(m) {
  const { regs, mem } = m;
  let block = 0x2202;
  for (;;) {
    switch (block) {
      case 0x2202: {
        regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x2204, 3);              // 2202 lda $43
        regs.and(0xaf); m.step(0x2206, 2);                                              // 2204 and #$af
        if (regs.fZ) { m.step(0x2209, 3); block = 0x2209; break; }                      // 2206 beq $2209
        m.step(0x2208, 2); block = 0x2208; break;
      }
      case 0x2208: {
        return m.ret(6);                                                                // 2208 rts
      }
      case 0x2209: {
        regs.x = 0x0d; regs.setNZ(regs.x); m.step(0x220b, 2);                           // 2209 ldx #$0d
        regs.a = mem.read8(0x0041); regs.setNZ(regs.a); m.step(0x220d, 3);              // 220b lda $41
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x220e, 2);                         // 220d tay
        regs.and(0x20); m.step(0x2210, 2);                                              // 220e and #$20
        if (regs.fZ) { m.step(0x2219, 3); block = 0x2219; break; }                      // 2210 beq $2219
        m.step(0x2212, 2); block = 0x2212; break;
      }
      case 0x2212: {
        regs.cpy(0xf8); m.step(0x2214, 2);                                              // 2212 cpy #$f8
        if (regs.fNC) { m.step(0x2208, 3); block = 0x2208; break; }                     // 2214 bcc $2208
        m.step(0x2216, 2); block = 0x2216; break;
      }
      case 0x2216: {
        m.step(0x22fa, 3); return m.call(0x22fa);                                       // 2216 jmp $22fa
      }
      case 0x2219: {
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x221b, 3);              // 2219 lda $00
        regs.and(0x03); m.step(0x221d, 2);                                              // 221b and #$03
        if (regs.fNZ) { m.step(0x222f, 3); block = 0x222f; break; }                     // 221d bne $222f
        m.step(0x221f, 2); block = 0x221f; break;
      }
      case 0x221f: {
        mem.write8(0x0041, regs.inc8(mem.read8(0x0041))); m.step(0x2221, 5);            // 221f inc $41
        regs.a = mem.read8(0x0041); regs.setNZ(regs.a); m.step(0x2223, 3);              // 2221 lda $41
        regs.eor(mem.read8(0x00f2)); m.step(0x2225, 3);                                 // 2223 eor $f2
        regs.cmp(0x1c); m.step(0x2227, 2);                                              // 2225 cmp #$1c
        if (regs.fNC) { m.step(0x222f, 3); block = 0x222f; break; }                     // 2227 bcc $222f
        m.step(0x2229, 2); block = 0x2229; break;
      }
      case 0x2229: {
        regs.a = 0x14; regs.setNZ(regs.a); m.step(0x222b, 2);                           // 2229 lda #$14
        regs.eor(mem.read8(0x00f2)); m.step(0x222d, 3);                                 // 222b eor $f2
        mem.write8(0x0041, regs.a); m.step(0x222f, 3);                                  // 222d sta $41
        block = 0x222f; break;
      }
      case 0x222f: {
        mem.write8(0x00a1, regs.dec8(mem.read8(0x00a1))); m.step(0x2231, 5);            // 222f dec $a1
        if (regs.fNZ) { m.step(0x2268, 3); block = 0x2268; break; }                     // 2231 bne $2268
        m.step(0x2233, 2); block = 0x2233; break;
      }
      case 0x2233: {
        regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x2236, 4);              // 2233 lda $100a
        regs.and(0x80); m.step(0x2238, 2);                                              // 2236 and #$80
        if (regs.fZ) { m.step(0x2252, 3); block = 0x2252; break; }                      // 2238 beq $2252
        m.step(0x223a, 2); block = 0x223a; break;
      }
      case 0x223a: {
        regs.a = mem.read8(0x0051); regs.setNZ(regs.a); m.step(0x223c, 3);              // 223a lda $51
        if (regs.fZ) { m.step(0x224e, 3); block = 0x224e; break; }                      // 223c beq $224e
        m.step(0x223e, 2); block = 0x223e; break;
      }
      case 0x223e: {
        regs.y = mem.read8(0x0061); regs.setNZ(regs.y); m.step(0x2240, 3);              // 223e ldy $61
        regs.cpy(0xfb); m.step(0x2242, 2);                                              // 2240 cpy #$fb
        if (regs.fC) { m.step(0x2252, 3); block = 0x2252; break; }                      // 2242 bcs $2252
        m.step(0x2244, 2); block = 0x2244; break;
      }
      case 0x2244: {
        regs.cpy(0x05); m.step(0x2246, 2);                                              // 2244 cpy #$05
        if (regs.fNC) { m.step(0x2252, 3); block = 0x2252; break; }                     // 2246 bcc $2252
        m.step(0x2248, 2); block = 0x2248; break;
      }
      case 0x2248: {
        mem.write8(0x00be, regs.a); m.step(0x224a, 3);                                  // 2248 sta $be
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x224c, 2);                           // 224a lda #$00
        if (regs.fZ) { m.step(0x2250, 3); block = 0x2250; break; }                      // 224c beq $2250
        m.step(0x224e, 2); block = 0x224e; break;
      }
      case 0x224e: {
        regs.a = mem.read8(0x00be); regs.setNZ(regs.a); m.step(0x2250, 3);              // 224e lda $be
        block = 0x2250; break;
      }
      case 0x2250: {
        mem.write8(0x0051, regs.a); m.step(0x2252, 3);                                  // 2250 sta $51
        block = 0x2252; break;
      }
      case 0x2252: {
        regs.a = mem.read8(0x00fd); regs.setNZ(regs.a); m.step(0x2254, 3);              // 2252 lda $fd
        regs.and(0x40); m.step(0x2256, 2);                                              // 2254 and #$40
        regs.ora(0x20); m.step(0x2258, 2);                                              // 2256 ora #$20
        regs.and(mem.read8(0x100a)); m.step(0x225b, 4);                                 // 2258 and $100a
        if (regs.fZ) { m.step(0x2264, 3); block = 0x2264; break; }                      // 225b beq $2264
        m.step(0x225d, 2); block = 0x225d; break;
      }
      case 0x225d: {
        regs.a = mem.read8(0x0081); regs.setNZ(regs.a); m.step(0x225f, 3);              // 225d lda $81
        m.push16(0x2261); m.step(0x2262, 6); m.call(0x382d);                                              // 225f jsr $382d
        mem.write8(0x0081, regs.a); m.step(0x2264, 3);                                  // 2262 sta $81
        block = 0x2264; break;
      }
      case 0x2264: {
        regs.a = 0x30; regs.setNZ(regs.a); m.step(0x2266, 2);                           // 2264 lda #$30
        mem.write8(0x00a1, regs.a); m.step(0x2268, 3);                                  // 2266 sta $a1
        block = 0x2268; break;
      }
      case 0x2268: {
        regs.a = mem.read8(0x0061); regs.setNZ(regs.a); m.step(0x226a, 3);              // 2268 lda $61
        regs.sec(); m.step(0x226b, 2);                                                  // 226a sec
        regs.sbc(mem.read8(0x0051)); m.step(0x226d, 3);                                 // 226b sbc $51
        mem.write8(0x0061, regs.a); m.step(0x226f, 3);                                  // 226d sta $61
        mem.write8(0x008b, regs.a); m.step(0x2271, 3);                                  // 226f sta $8b
        regs.a = mem.read8(0x0071); regs.setNZ(regs.a); m.step(0x2273, 3);              // 2271 lda $71
        regs.y = mem.read8(0x00ef); regs.setNZ(regs.y); m.step(0x2275, 3);              // 2273 ldy $ef
        if (regs.fZ) { m.step(0x227d, 3); block = 0x227d; break; }                      // 2275 beq $227d
        m.step(0x2277, 2); block = 0x2277; break;
      }
      case 0x2277: {
        regs.clc(); m.step(0x2278, 2);                                                  // 2277 clc
        regs.adc(mem.read8(0x0081)); m.step(0x227a, 3);                                 // 2278 adc $81
        m.step(0x2280, 3); return m.call(0x2280);                                       // 227a jmp $2280
      }
      case 0x227d: {
        regs.sec(); m.step(0x227e, 2);                                                  // 227d sec
        regs.sbc(mem.read8(0x0081)); m.step(0x2280, 3);                                 // 227e sbc $81
        return m.call(0x2280);                                                          // (falls into loc_2280)
      }
    }
  }
}
