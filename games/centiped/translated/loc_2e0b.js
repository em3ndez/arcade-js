// SPDX-License-Identifier: GPL-3.0-only
// loc_2e0b  (ROM 0x2e0b-0x2e8c) -- steers head $40/$70 + seeds velocity $50/$60/$80; a pc-dispatch loop keeps each opcode's step + cycles exact, then falls into loc_2e8c.
export function loc_2e0b(m) {
  const { regs, mem } = m;
  let pc = 0x2e0b;
  for (;;) {
    switch (pc) {
      case 0x2e0b:
        regs.a = mem.read8(0x0040); regs.setNZ(regs.a); m.step(0x2e0d, 3);  // 2e0b lda $40
        regs.eor(mem.read8(0x00ef)); m.step(0x2e0f, 3);                     // 2e0d eor $ef
        regs.cmp(0x34); m.step(0x2e11, 2);                                  // 2e0f cmp #$34
        if (regs.fNC) { m.step(0x2e16, 3); pc = 0x2e16; break; }            // 2e11 bcc $2e16
        m.step(0x2e13, 2); pc = 0x2e13; break;
      case 0x2e13:
        m.step(0x2e94, 3); return m.call(0x2e94);                           // 2e13 jmp $2e94
      case 0x2e16:
        regs.cmp(0x30); m.step(0x2e18, 2);                                  // 2e16 cmp #$30
        if (regs.fC) { m.step(0x2e77, 3); pc = 0x2e77; break; }             // 2e18 bcs $2e77
        m.step(0x2e1a, 2); pc = 0x2e1a; break;
      case 0x2e1a:
        regs.a = mem.read8(0x0070); regs.setNZ(regs.a); m.step(0x2e1c, 3);  // 2e1a lda $70
        regs.eor(mem.read8(0x00f0)); m.step(0x2e1e, 3);                     // 2e1c eor $f0
        regs.cmp(0xf8); m.step(0x2e20, 2);                                  // 2e1e cmp #$f8
        if (regs.fNC) { m.step(0x2e26, 3); pc = 0x2e26; break; }            // 2e20 bcc $2e26
        m.step(0x2e22, 2); pc = 0x2e22; break;
      case 0x2e22:
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x2e24, 3);  // 2e22 lda $00
        if (regs.fZ) { m.step(0x2e29, 3); pc = 0x2e29; break; }             // 2e24 beq $2e29
        m.step(0x2e26, 2); pc = 0x2e26; break;
      case 0x2e26:
        m.step(0x2ec5, 3); return m.call(0x2ec5);                           // 2e26 jmp $2ec5
      case 0x2e29:
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2e2b, 3);  // 2e29 ldx $88
        regs.a = mem.read8((0x9a + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2e2d, 4); // 2e2b lda $9a,x
        regs.cmp(0x0b); m.step(0x2e2f, 2);                                  // 2e2d cmp #$0b
        if (regs.fC) { m.step(0x2e26, 3); pc = 0x2e26; break; }             // 2e2f bcs $2e26
        m.step(0x2e31, 2); pc = 0x2e31; break;
      case 0x2e31:
        regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x2e34, 4);  // 2e31 lda $100a
        regs.and(0x03); m.step(0x2e36, 2);                                  // 2e34 and #$03
        if (regs.fNZ) { m.step(0x2e26, 3); pc = 0x2e26; break; }            // 2e36 bne $2e26
        m.step(0x2e38, 2); pc = 0x2e38; break;
      case 0x2e38:
        regs.a = 0x14; regs.setNZ(regs.a); m.step(0x2e3a, 2);
        mem.write8(0x00b8, regs.a); m.step(0x2e3c, 3);                      // 2e3a sta $b8
        regs.a = 0x30; regs.setNZ(regs.a); m.step(0x2e3e, 2);
        regs.eor(mem.read8(0x00ef)); m.step(0x2e40, 3);                     // 2e3e eor $ef
        mem.write8(0x0040, regs.a); m.step(0x2e42, 3);                      // 2e40 sta $40
        regs.a = mem.read8((0xab + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2e44, 4); // 2e42 lda $ab,x
        regs.cmp(0x02); m.step(0x2e46, 2);                                  // 2e44 cmp #$02
        if (regs.fNC) { m.step(0x2e5a, 3); pc = 0x2e5a; break; }            // 2e46 bcc $2e5a
        m.step(0x2e48, 2); pc = 0x2e48; break;
      case 0x2e48:
        regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x2e4b, 4);  // 2e48 lda $100a
        regs.and(0x03); m.step(0x2e4d, 2);                                  // 2e4b and #$03
        if (regs.fZ) { m.step(0x2e5a, 3); pc = 0x2e5a; break; }             // 2e4d beq $2e5a
        m.step(0x2e4f, 2); pc = 0x2e4f; break;
      case 0x2e4f:
        regs.a = 0x02; regs.setNZ(regs.a); m.step(0x2e51, 2);               // 2e4f lda #$02
        regs.bit(mem.read8(0x100a)); m.step(0x2e54, 4);                     // 2e51 bit $100a
        if (regs.fPl) { m.step(0x2e63, 3); pc = 0x2e63; break; }            // 2e54 bpl $2e63
        m.step(0x2e56, 2); pc = 0x2e56; break;
      case 0x2e56:
        regs.a = 0xfe; regs.setNZ(regs.a); m.step(0x2e58, 2);
        if (regs.fNZ) { m.step(0x2e63, 3); pc = 0x2e63; break; }            // 2e58 bne $2e63
        m.step(0x2e5a, 2); pc = 0x2e5a; break;
      case 0x2e5a:
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0x2e5c, 2);               // 2e5a lda #$01
        regs.bit(mem.read8(0x100a)); m.step(0x2e5f, 4);                     // 2e5c bit $100a
        if (regs.fPl) { m.step(0x2e63, 3); pc = 0x2e63; break; }            // 2e5f bpl $2e63
        m.step(0x2e61, 2); pc = 0x2e61; break;
      case 0x2e61:
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0x2e63, 2);
        pc = 0x2e63; break;
      case 0x2e63:
        mem.write8(0x0050, regs.a); m.step(0x2e65, 3);                      // 2e63 sta $50
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2e67, 2);
        mem.write8(0x0060, regs.a); m.step(0x2e69, 3);                      // 2e67 sta $60
        mem.write8(0x0080, regs.a); m.step(0x2e6b, 3);                      // 2e69 sta $80
        regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x2e6e, 4);  // 2e6b lda $100a
        regs.and(0x78); m.step(0x2e70, 2);                                  // 2e6e and #$78
        regs.clc(); m.step(0x2e71, 2);                                      // 2e70 clc
        regs.adc(0x70); m.step(0x2e73, 2);                                  // 2e71 adc #$70
        regs.eor(mem.read8(0x00f0)); m.step(0x2e75, 3);                     // 2e73 eor $f0
        mem.write8(0x0070, regs.a); m.step(0x2e77, 3);                      // 2e75 sta $70
        pc = 0x2e77; break;
      case 0x2e77:
        regs.a = mem.read8(0x0043); regs.setNZ(regs.a); m.step(0x2e79, 3);  // 2e77 lda $43
        regs.and(0xaf); m.step(0x2e7b, 2);                                  // 2e79 and #$af
        if (regs.fNZ) { m.step(0x2e9a, 3); m.step(0x20e8, 3); return m.call(0x20e8); } // 2e7b bne $2e9a (-> jmp $20e8)
        m.step(0x2e7d, 2); pc = 0x2e7d; break;
      case 0x2e7d:
        regs.a = mem.read8(0x0060); regs.setNZ(regs.a); m.step(0x2e7f, 3);  // 2e7d lda $60
        regs.y = mem.read8(0x00ef); regs.setNZ(regs.y); m.step(0x2e81, 3);  // 2e7f ldy $ef
        if (regs.fZ) { m.step(0x2e89, 3); pc = 0x2e89; break; }             // 2e81 beq $2e89
        m.step(0x2e83, 2); pc = 0x2e83; break;
      case 0x2e83:
        regs.sec(); m.step(0x2e84, 2);                                      // 2e83 sec
        regs.sbc(mem.read8(0x0050)); m.step(0x2e86, 3);                     // 2e84 sbc $50
        m.step(0x2e8c, 3); return m.call(0x2e8c);                           // 2e86 jmp $2e8c
      case 0x2e89:
        regs.clc(); m.step(0x2e8a, 2);                                      // 2e89 clc
        regs.adc(mem.read8(0x0050)); m.step(0x2e8c, 3);                     // 2e8a adc $50
        return m.call(0x2e8c);                                              // fall through into loc_2e8c
      default:
        throw new Error("loc_2e0b: unreachable pc 0x" + pc.toString(16));
    }
  }
}
