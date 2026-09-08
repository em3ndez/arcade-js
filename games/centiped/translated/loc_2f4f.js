// SPDX-License-Identifier: GPL-3.0-only
// loc_2f4f (ROM 0x2f4f-0x3031) -- per-segment collision/ranging test that dispatches a mover then chains onward.
export function loc_2f4f(m) {
  const { regs, mem } = m;
  let label = 0x2f4f;
  for (;;) {
    switch (label) {
      case 0x2f4f: {
        regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2f51, 4); // 2f4f lda $34,x
        regs.cmp(0x76); m.step(0x2f53, 2); // 2f51 cmp #$76
        if (regs.fNC) { // 2f53 bcc $2f5d
          m.step(0x2f5d, 3); label = 0x2f5d; continue;
        }
        m.step(0x2f55, 2);
        regs.cmp(0xb9); m.step(0x2f57, 2); // 2f55 cmp #$b9
        if (regs.fNC) { // 2f57 bcc $2fc2
          m.step(0x2fc2, 3); label = 0x2fc2; continue;
        }
        m.step(0x2f59, 2);
        regs.cmp(0xf8); m.step(0x2f5b, 2); // 2f59 cmp #$f8
        if (regs.fC) { // 2f5b bcs $2fc2
          m.step(0x2fc2, 3); label = 0x2fc2; continue;
        }
        m.step(0x2f5d, 2);
        label = 0x2f5d; continue;
      }
      case 0x2f5d: {
        regs.a = mem.read8((0x64 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2f5f, 4); // 2f5d lda $64,x
        regs.eor(mem.read8(0x00f0)); m.step(0x2f61, 3); // 2f5f eor $f0
        regs.cmp(0xf8); m.step(0x2f63, 2); // 2f61 cmp #$f8
        if (regs.fC) { // 2f63 bcs $2fc2
          m.step(0x2fc2, 3); label = 0x2fc2; continue;
        }
        m.step(0x2f65, 2);
        regs.eor(mem.read8(0x00f0)); m.step(0x2f67, 3); // 2f65 eor $f0
        regs.sec(); m.step(0x2f68, 2); // 2f67 sec
        regs.sbc(mem.read8(0x0072)); m.step(0x2f6a, 3); // 2f68 sbc $72
        m.push16(0x2f6c); m.step(0x2f6d, 6); m.call(0x382b); // 2f6a jsr $382b
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x2f6e, 2); // 2f6d tay
        regs.cpx(0x0c); m.step(0x2f70, 2); // 2f6e cpx #$0c
        if (regs.fNZ) { // 2f70 bne $2f88
          m.step(0x2f88, 3); label = 0x2f88; continue;
        }
        m.step(0x2f72, 2);
        regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2f74, 4); // 2f72 lda $34,x
        regs.eor(mem.read8(0x00ef)); m.step(0x2f76, 3); // 2f74 eor $ef
        regs.cmp(0x20); m.step(0x2f78, 2); // 2f76 cmp #$20
        if (regs.fC) { // 2f78 bcs $2f88
          m.step(0x2f88, 3); label = 0x2f88; continue;
        }
        m.step(0x2f7a, 2);
        regs.a = mem.read8(0x0080); regs.setNZ(regs.a); m.step(0x2f7c, 3); // 2f7a lda $80
        regs.eor(mem.read8(0x00f0)); m.step(0x2f7e, 3); // 2f7c eor $f0
        regs.cmp(0x04); m.step(0x2f80, 2); // 2f7e cmp #$04
        if (regs.fNC) { // 2f80 bcc $2f88
          m.step(0x2f88, 3); label = 0x2f88; continue;
        }
        m.step(0x2f82, 2);
        regs.cpy(0x07); m.step(0x2f84, 2); // 2f82 cpy #$07
        if (regs.fC) { // 2f84 bcs $2fc2
          m.step(0x2fc2, 3); label = 0x2fc2; continue;
        }
        m.step(0x2f86, 2);
        if (regs.fNC) { // 2f86 bcc $2f8c
          m.step(0x2f8c, 3); label = 0x2f8c; continue;
        }
        m.step(0x2f88, 2);
        label = 0x2f88; continue;
      }
      case 0x2f88: {
        regs.cpy(0x05); m.step(0x2f8a, 2); // 2f88 cpy #$05
        if (regs.fC) { // 2f8a bcs $2fc2
          m.step(0x2fc2, 3); label = 0x2fc2; continue;
        }
        m.step(0x2f8c, 2);
        label = 0x2f8c; continue;
      }
      case 0x2f8c: {
        regs.a = mem.read8((0x54 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2f8e, 4); // 2f8c lda $54,x
        regs.sec(); m.step(0x2f8f, 2); // 2f8e sec
        regs.sbc(mem.read8(0x0062)); m.step(0x2f91, 3); // 2f8f sbc $62
        m.push16(0x2f93); m.step(0x2f94, 6); m.call(0x382b); // 2f91 jsr $382b
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x2f95, 2); // 2f94 tay
        regs.cpx(0x0d); m.step(0x2f97, 2); // 2f95 cpx #$0d
        if (regs.fZ) { // 2f97 beq $2fbe
          m.step(0x2fbe, 3); label = 0x2fbe; continue;
        }
        m.step(0x2f99, 2);
        regs.cpx(0x0c); m.step(0x2f9b, 2); // 2f99 cpx #$0c
        if (regs.fNC) { // 2f9b bcc $2ffd
          m.step(0x2ffd, 3); label = 0x2ffd; continue;
        }
        m.step(0x2f9d, 2);
        regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x2f9f, 4); // 2f9d lda $34,x
        regs.eor(mem.read8(0x00ef)); m.step(0x2fa1, 3); // 2f9f eor $ef
        regs.cmp(0x20); m.step(0x2fa3, 2); // 2fa1 cmp #$20
        if (regs.fC) { // 2fa3 bcs $2fb5
          m.step(0x2fb5, 3); label = 0x2fb5; continue;
        }
        m.step(0x2fa5, 2);
        regs.cpy(0x06); m.step(0x2fa7, 2); // 2fa5 cpy #$06
        if (regs.fC) { // 2fa7 bcs $2fc2
          m.step(0x2fc2, 3); label = 0x2fc2; continue;
        }
        m.step(0x2fa9, 2);
        regs.y = 0x02; regs.setNZ(regs.y); m.step(0x2fab, 2); // 2fa9 ldy #$02
        regs.a = 0x04; regs.setNZ(regs.a); m.step(0x2fad, 2); // 2fab lda #$04
        regs.cmp(mem.read8(0x0080)); m.step(0x2faf, 3); // 2fad cmp $80
        if (regs.fZ) { // 2faf beq $2fbb
          m.step(0x2fbb, 3); label = 0x2fbb; continue;
        }
        m.step(0x2fb1, 2);
        mem.write8(0x0080, regs.a); m.step(0x2fb3, 3); // 2fb1 sta $80
        if (regs.fNZ) { // 2fb3 bne $2f4a
          m.step(0x2f4a, 3); m.step(0x3046, 3); return m.call(0x3046); // 2f4a jmp $3046 (interior)
        }
        m.step(0x2fb5, 2);
        label = 0x2fb5; continue;
      }
      case 0x2fb5: {
        regs.cpy(0x0a); m.step(0x2fb7, 2); // 2fb5 cpy #$0a
        if (regs.fC) { // 2fb7 bcs $2fc2
          m.step(0x2fc2, 3); label = 0x2fc2; continue;
        }
        m.step(0x2fb9, 2);
        regs.y = 0x10; regs.setNZ(regs.y); m.step(0x2fbb, 2); // 2fb9 ldy #$10
        label = 0x2fbb; continue;
      }
      case 0x2fbb: {
        m.step(0x3037, 3); return m.call(0x3037); // 2fbb jmp $3037
      }
      case 0x2fbe: {
        regs.cpy(0x0a); m.step(0x2fc0, 2); // 2fbe cpy #$0a
        if (regs.fNC) { // 2fc0 bcc $2fc5
          m.step(0x2fc5, 3); label = 0x2fc5; continue;
        }
        m.step(0x2fc2, 2);
        label = 0x2fc2; continue;
      }
      case 0x2fc2: {
        m.step(0x3031, 3); return m.call(0x3031); // 2fc2 jmp $3031
      }
      case 0x2fc5: {
        regs.y = 0xb6; regs.setNZ(regs.y); m.step(0x2fc7, 2); // 2fc5 ldy #$b6
        mem.write8(0x00d7, regs.y); m.step(0x2fc9, 3); // 2fc7 sty $d7
        regs.y = 0x03; regs.setNZ(regs.y); m.step(0x2fcb, 2); // 2fc9 ldy #$03
        regs.a = mem.read8(0x0071); regs.setNZ(regs.a); m.step(0x2fcd, 3); // 2fcb lda $71
        regs.sec(); m.step(0x2fce, 2); // 2fcd sec
        regs.sbc(mem.read8(0x0073)); m.step(0x2fd0, 3); // 2fce sbc $73
        m.push16(0x2fd2); m.step(0x2fd3, 6); m.call(0x382b); // 2fd0 jsr $382b
        regs.cmp(0x40); m.step(0x2fd5, 2); // 2fd3 cmp #$40
        if (regs.fC) { // 2fd5 bcs $2fe3
          m.step(0x2fe3, 3); label = 0x2fe3; continue;
        }
        m.step(0x2fd7, 2);
        mem.write8(0x00d7, regs.inc8(mem.read8(0x00d7))); m.step(0x2fd9, 5); // 2fd7 inc $d7
        regs.y = 0x09; regs.setNZ(regs.y); m.step(0x2fdb, 2); // 2fd9 ldy #$09
        regs.cmp(0x16); m.step(0x2fdd, 2); // 2fdb cmp #$16
        if (regs.fNC) { // 2fdd bcc $2fe3
          m.step(0x2fe3, 3); label = 0x2fe3; continue;
        }
        m.step(0x2fdf, 2);
        mem.write8(0x00d7, regs.inc8(mem.read8(0x00d7))); m.step(0x2fe1, 5); // 2fdf inc $d7
        regs.y = 0x06; regs.setNZ(regs.y); m.step(0x2fe3, 2); // 2fe1 ldy #$06
        label = 0x2fe3; continue;
      }
      case 0x2fe3: {
        regs.a = 0x80; regs.setNZ(regs.a); m.step(0x2fe5, 2); // 2fe3 lda #$80
        mem.write8(0x009f, regs.a); m.step(0x2fe7, 3); // 2fe5 sta $9f
        mem.write8(0x00a1, regs.a); m.step(0x2fe9, 3); // 2fe7 sta $a1
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2feb, 2); // 2fe9 lda #$00
        mem.write8(0x00b5, regs.a); m.step(0x2fed, 3); // 2feb sta $b5
        regs.a = 0xf0; regs.setNZ(regs.a); m.step(0x2fef, 2); // 2fed lda #$f0
        regs.cmp(mem.read8(0x0061)); m.step(0x2ff1, 3); // 2fef cmp $61
        if (regs.fNC) { // 2ff1 bcc $2ff9
          m.step(0x2ff9, 3); label = 0x2ff9; continue;
        }
        m.step(0x2ff3, 2);
        regs.a = 0x10; regs.setNZ(regs.a); m.step(0x2ff5, 2); // 2ff3 lda #$10
        regs.cmp(mem.read8(0x0061)); m.step(0x2ff7, 3); // 2ff5 cmp $61
        if (regs.fNC) { // 2ff7 bcc $3037
          m.step(0x3037, 4); return m.call(0x3037);
        }
        m.step(0x2ff9, 2);
        label = 0x2ff9; continue;
      }
      case 0x2ff9: {
        mem.write8(0x0061, regs.a); m.step(0x2ffb, 3); // 2ff9 sta $61
        if (regs.fNZ) { // 2ffb bne $3037
          m.step(0x3037, 4); return m.call(0x3037);
        }
        m.step(0x2ffd, 2);
        label = 0x2ffd; continue;
      }
      case 0x2ffd: {
        regs.cpy(0x06); m.step(0x2fff, 2); // 2ffd cpy #$06
        if (regs.fC) { // 2fff bcs $3031
          m.step(0x3031, 3); return m.call(0x3031);
        }
        m.step(0x3001, 2);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3003, 2); // 3001 lda #$00
        mem.write8(0x008b, regs.a); m.step(0x3005, 3); // 3003 sta $8b
        regs.y = 0x10; regs.setNZ(regs.y); m.step(0x3007, 2); // 3005 ldy #$10
        regs.a = mem.read8((0x34 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x3009, 4); // 3007 lda $34,x
        regs.and(0x40); m.step(0x300b, 2); // 3009 and #$40
        if (regs.fNZ) { // 300b bne $3011
          m.step(0x3011, 3); label = 0x3011; continue;
        }
        m.step(0x300d, 2);
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x300f, 2); // 300d ldy #$00
        mem.write8(0x008b, regs.inc8(mem.read8(0x008b))); m.step(0x3011, 5); // 300f inc $8b
        label = 0x3011; continue;
      }
      case 0x3011: {
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x3012, 2); // 3011 tya
        m.push16(0x3014); m.step(0x3015, 6); m.call(0x2dae); // 3012 jsr $2dae
        regs.cpx(0x0b); m.step(0x3017, 2); // 3015 cpx #$0b
        if (regs.fZ) { // 3017 beq $3021
          m.step(0x3021, 3); label = 0x3021; continue;
        }
        m.step(0x3019, 2);
        regs.a = mem.read8((0x35 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x301b, 4); // 3019 lda $35,x
        if (regs.fN) { // 301b bmi $3021
          m.step(0x3021, 3); label = 0x3021; continue;
        }
        m.step(0x301d, 2);
        regs.and(0xbf); m.step(0x301f, 2); // 301d and #$bf
        mem.write8((0x35 + regs.x) & 0xff, regs.a); m.step(0x3021, 4); // 301f sta $35,x
        label = 0x3021; continue;
      }
      case 0x3021: {
        m.push16(0x3023); m.step(0x3024, 6); m.call(0x2310); // 3021 jsr $2310
        m.push16(0x3026); m.step(0x3027, 6); m.call(0x2c2b); // 3024 jsr $2c2b
        mem.write8(0x008d, regs.x); m.step(0x3029, 3); // 3027 stx $8d
        m.push16(0x302b); m.step(0x302c, 6); m.call(0x2ba8); // 3029 jsr $2ba8
        regs.x = mem.read8(0x008d); regs.setNZ(regs.x); m.step(0x302e, 3); // 302c ldx $8d
        m.step(0x303e, 3); return m.call(0x303e); // 302e jmp $303e
      }
    }
  }
}
