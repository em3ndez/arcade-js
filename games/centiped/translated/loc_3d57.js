// SPDX-License-Identifier: GPL-3.0-only
// loc_3d57 (ROM 0x3d57-0x3fd6) -- polls $8a + the 0x0800/0x0c00 input ports, updates display/sound
// cells, calls the draw helpers (0x3825/0x3836/0x384f/0x3a08/0x3ac0), then chains into loc_3fd6.
export function loc_3d57(m) {
  const { regs, mem } = m;
  let label = 0x3d57;
  for (;;) {
    switch (label) {
      case 0x3d57: {
        mem.write8(0x008a, regs.lsr(mem.read8(0x008a))); m.step(0x3d59, 5); // 3d57 lsr $8a
        if (regs.fNC) { m.step(0x3d57, 3); label = 0x3d57; continue; } // 3d59 bcc $3d57
        m.step(0x3d5b, 2);
        regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0x3d5e, 4);
        regs.and(0x20); m.step(0x3d60, 2); // 3d5e and #$20
        label = 0x3d60; continue;
      }
      case 0x3d60: {
        if (regs.fNZ) { m.step(0x3d60, 3); label = 0x3d60; continue; } // 3d60 bne $3d60
        m.step(0x3d62, 2);
        mem.write8(0x2000, regs.a); m.step(0x3d65, 4);
        regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x3d68, 4);
        regs.a = regs.lsr(regs.a); m.step(0x3d69, 2); // 3d68 lsr a
        mem.write8(0x00ea, regs.rol(mem.read8(0x00ea))); m.step(0x3d6b, 5); // 3d69 rol $ea
        regs.a = mem.read8(0x00ea); regs.setNZ(regs.a); m.step(0x3d6d, 3);
        regs.and(0x03); m.step(0x3d6f, 2); // 3d6d and #$03
        regs.cmp(0x02); m.step(0x3d71, 2); // 3d6f cmp #$02
        if (regs.fNZ) { m.step(0x3d97, 3); label = 0x3d97; continue; } // 3d71 bne $3d97
        m.step(0x3d73, 2);
        regs.a = mem.read8(0x00e6); regs.setNZ(regs.a); m.step(0x3d75, 3);
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x3d76, 2); // 3d75 tax
        regs.clc(); m.step(0x3d77, 2); // 3d76 clc
        regs.adc(0x02); m.step(0x3d79, 2); // 3d77 adc #$02
        regs.and(0x06); m.step(0x3d7b, 2); // 3d79 and #$06
        mem.write8(0x00e6, regs.a); m.step(0x3d7d, 3);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3d7f, 2);
        mem.write8((0x1001 + regs.x) & 0xffff, regs.a); m.step(0x3d82, 5);
        regs.a = mem.read8(0x00e7); regs.setNZ(regs.a); m.step(0x3d84, 3);
        regs.clc(); m.step(0x3d85, 2); // 3d84 clc
        regs.adc(0x01); m.step(0x3d87, 2); // 3d85 adc #$01
        regs.and(0x0f); m.step(0x3d89, 2); // 3d87 and #$0f
        mem.write8(0x00e7, regs.a); m.step(0x3d8b, 3);
        regs.x = mem.read8(0x00e8); regs.setNZ(regs.x); m.step(0x3d8d, 3); // 3d8b ldx $e8
        regs.x = regs.inc8(regs.x); m.step(0x3d8e, 2); // 3d8d inx
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3d8f, 2); // 3d8e txa
        regs.and(0x0f); m.step(0x3d91, 2); // 3d8f and #$0f
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x3d92, 2); // 3d91 tax
        mem.write8(0x1404, regs.x); m.step(0x3d95, 4); // 3d92 stx $1404
        mem.write8(0x00e8, regs.x); m.step(0x3d97, 3); // 3d95 stx $e8
        label = 0x3d97; continue;
      }
      case 0x3d97: {
        regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x3d9a, 4);
        regs.a = regs.lsr(regs.a); m.step(0x3d9b, 2); // 3d9a lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3d9c, 2); // 3d9b lsr a
        mem.write8(0x00eb, regs.rol(mem.read8(0x00eb))); m.step(0x3d9e, 5); // 3d9c rol $eb
        regs.a = mem.read8(0x00eb); regs.setNZ(regs.a); m.step(0x3da0, 3);
        regs.and(0x03); m.step(0x3da2, 2); // 3da0 and #$03
        regs.cmp(0x02); m.step(0x3da4, 2); // 3da2 cmp #$02
        if (regs.fNZ) { m.step(0x3dbc, 3); label = 0x3dbc; continue; } // 3da4 bne $3dbc
        m.step(0x3da6, 2);
        mem.write8(0x00e9, regs.inc8(mem.read8(0x00e9))); m.step(0x3da8, 5); // 3da6 inc $e9
        regs.a = mem.read8(0x00e9); regs.setNZ(regs.a); m.step(0x3daa, 3);
        regs.y = 0x01; regs.setNZ(regs.y); m.step(0x3dac, 2); // 3daa ldy #$01
        label = 0x3dac; continue;
      }
      case 0x3dac: {
        regs.clc(); m.step(0x3dad, 2); // 3dac clc
        regs.adc(0x01); m.step(0x3daf, 2); // 3dad adc #$01
        regs.and(0x0f); m.step(0x3db1, 2); // 3daf and #$0f
        mem.write8((0x1404 + regs.y) & 0xffff, regs.a); m.step(0x3db4, 5);
        mem.write8((0x140c + regs.y) & 0xffff, regs.a); m.step(0x3db7, 5);
        regs.y = regs.inc8(regs.y); m.step(0x3db8, 2); // 3db7 iny
        regs.cpy(0x04); m.step(0x3dba, 2); // 3db8 cpy #$04
        if (regs.fNC) { m.step(0x3dac, 3); label = 0x3dac; continue; } // 3dba bcc $3dac
        m.step(0x3dbc, 2);
        label = 0x3dbc; continue;
      }
      case 0x3dbc: {
        regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x3dbf, 4);
        regs.a = regs.lsr(regs.a); m.step(0x3dc0, 2); // 3dbf lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3dc1, 2); // 3dc0 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3dc2, 2); // 3dc1 lsr a
        mem.write8(0x00ec, regs.rol(mem.read8(0x00ec))); m.step(0x3dc4, 5); // 3dc2 rol $ec
        regs.a = mem.read8(0x00ec); regs.setNZ(regs.a); m.step(0x3dc6, 3);
        regs.and(0x03); m.step(0x3dc8, 2); // 3dc6 and #$03
        regs.eor(0x02); m.step(0x3dca, 2); // 3dc8 eor #$02
        if (regs.fNZ) { m.step(0x3de1, 3); label = 0x3de1; continue; } // 3dca bne $3de1
        m.step(0x3dcc, 2);
        mem.write8(0x00bd, regs.a); m.step(0x3dce, 3);
        mem.write8(0x00bf, regs.a); m.step(0x3dd0, 3);
        mem.write8(0x2400, regs.a); m.step(0x3dd3, 4);
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0x3dd5, 2);
        mem.write8(0x1c07, regs.a); m.step(0x3dd8, 4);
        mem.write8(0x0088, regs.a); m.step(0x3dda, 3);
        regs.x = 0x0f; regs.setNZ(regs.x); m.step(0x3ddc, 2); // 3dda ldx #$0f
        label = 0x3ddc; continue;
      }
      case 0x3ddc: {
        mem.write8((0x0034 + regs.x) & 0xff, regs.inc8(mem.read8((0x0034 + regs.x) & 0xff))); m.step(0x3dde, 6); // 3ddc inc $34,x
        regs.x = regs.dec8(regs.x); m.step(0x3ddf, 2); // 3dde dex
        if (regs.fPl) { m.step(0x3ddc, 3); label = 0x3ddc; continue; } // 3ddf bpl $3ddc
        m.step(0x3de1, 2);
        label = 0x3de1; continue;
      }
      case 0x3de1: {
        regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x3de4, 4);
        regs.a = regs.lsr(regs.a); m.step(0x3de5, 2); // 3de4 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3de6, 2); // 3de5 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3de7, 2); // 3de6 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3de8, 2); // 3de7 lsr a
        mem.write8(0x00ed, regs.rol(mem.read8(0x00ed))); m.step(0x3dea, 5); // 3de8 rol $ed
        regs.a = mem.read8(0x00ed); regs.setNZ(regs.a); m.step(0x3dec, 3);
        regs.and(0x03); m.step(0x3dee, 2); // 3dec and #$03
        regs.eor(0x02); m.step(0x3df0, 2); // 3dee eor #$02
        if (regs.fNZ) { m.step(0x3e02, 4); label = 0x3e02; continue; } // 3df0 bne $3e02 (page-cross)
        m.step(0x3df2, 2);
        mem.write8(0x00bd, regs.a); m.step(0x3df4, 3);
        mem.write8(0x00bf, regs.a); m.step(0x3df6, 3);
        mem.write8(0x2400, regs.a); m.step(0x3df9, 4);
        regs.a = 0x02; regs.setNZ(regs.a); m.step(0x3dfb, 2);
        mem.write8(0x0088, regs.a); m.step(0x3dfd, 3);
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0x3dff, 2);
        mem.write8(0x1c07, regs.a); m.step(0x3e02, 4);
        label = 0x3e02; continue;
      }
      case 0x3e02: {
        regs.a = 0x05; regs.setNZ(regs.a); m.step(0x3e04, 2);
        mem.write8(0x0092, regs.a); m.step(0x3e06, 3);
        regs.a = 0x38; regs.setNZ(regs.a); m.step(0x3e08, 2);
        mem.write8(0x0091, regs.a); m.step(0x3e0a, 3);
        regs.a = mem.read8(0x0800); regs.setNZ(regs.a); m.step(0x3e0d, 4);
        regs.and(0x0c); m.step(0x3e0f, 2); // 3e0d and #$0c
        regs.a = regs.lsr(regs.a); m.step(0x3e10, 2); // 3e0f lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3e11, 2); // 3e10 lsr a
        regs.adc(0x01); m.step(0x3e13, 2); // 3e11 adc #$01
        mem.write8(0x008b, regs.a); m.step(0x3e15, 3);
        regs.x = 0x05; regs.setNZ(regs.x); m.step(0x3e17, 2); // 3e15 ldx #$05
        label = 0x3e17; continue;
      }
      case 0x3e17: {
        regs.a = 0x1f; regs.setNZ(regs.a); m.step(0x3e19, 2);
        regs.bit(mem.read8(0x008b)); m.step(0x3e1b, 3); // 3e19 bit $8b
        if (regs.fPl) { m.step(0x3e1f, 3); label = 0x3e1f; continue; } // 3e1b bpl $3e1f
        m.step(0x3e1d, 2);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3e1f, 2);
        label = 0x3e1f; continue;
      }
      case 0x3e1f: {
        m.step(0x3e22, 6); m.call(0x3836); // 3e1f jsr $3836
        mem.write8(0x008b, regs.dec8(mem.read8(0x008b))); m.step(0x3e24, 5); // 3e22 dec $8b
        regs.x = regs.dec8(regs.x); m.step(0x3e25, 2); // 3e24 dex
        if (regs.fNZ) { m.step(0x3e17, 3); label = 0x3e17; continue; } // 3e25 bne $3e17
        m.step(0x3e27, 2);
        regs.a = 0x37; regs.setNZ(regs.a); m.step(0x3e29, 2);
        mem.write8(0x0091, regs.a); m.step(0x3e2b, 3);
        regs.a = 0x21; regs.setNZ(regs.a); m.step(0x3e2d, 2);
        m.step(0x3e30, 6); m.call(0x3836); // 3e2d jsr $3836
        regs.a = mem.read8(0x0801); regs.setNZ(regs.a); m.step(0x3e33, 4);
        regs.and(0x10); m.step(0x3e35, 2); // 3e33 and #$10
        regs.a = regs.lsr(regs.a); m.step(0x3e36, 2); // 3e35 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3e37, 2); // 3e36 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3e38, 2); // 3e37 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3e39, 2); // 3e38 lsr a
        regs.adc(0x01); m.step(0x3e3b, 2); // 3e39 adc #$01
        regs.ora(0x20); m.step(0x3e3d, 2); // 3e3b ora #$20
        m.step(0x3e40, 6); m.call(0x3836); // 3e3d jsr $3836
        regs.a = mem.read8(0x0801); regs.setNZ(regs.a); m.step(0x3e43, 4);
        regs.and(0x0c); m.step(0x3e45, 2); // 3e43 and #$0c
        regs.a = regs.lsr(regs.a); m.step(0x3e46, 2); // 3e45 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3e47, 2); // 3e46 lsr a
        if (regs.fNZ) { m.step(0x3e4b, 3); label = 0x3e4b; continue; } // 3e47 bne $3e4b
        m.step(0x3e49, 2);
        regs.a = 0xfe; regs.setNZ(regs.a); m.step(0x3e4b, 2);
        label = 0x3e4b; continue;
      }
      case 0x3e4b: {
        regs.adc(0x03); m.step(0x3e4d, 2); // 3e4b adc #$03
        regs.ora(0x20); m.step(0x3e4f, 2); // 3e4d ora #$20
        m.step(0x3e52, 6); m.call(0x3836); // 3e4f jsr $3836
        regs.a = 0x36; regs.setNZ(regs.a); m.step(0x3e54, 2);
        mem.write8(0x0091, regs.a); m.step(0x3e56, 3);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3e58, 2);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x3e59, 2); // 3e58 tay
        mem.write8((mem.read16(0x0091) + regs.y) & 0xffff, regs.a); m.step(0x3e5b, 6);
        regs.y = 0x40; regs.setNZ(regs.y); m.step(0x3e5d, 2); // 3e5b ldy #$40
        mem.write8((mem.read16(0x0091) + regs.y) & 0xffff, regs.a); m.step(0x3e5f, 6);
        regs.a = mem.read8(0x0801); regs.setNZ(regs.a); m.step(0x3e62, 4);
        regs.a = regs.lsr(regs.a); m.step(0x3e63, 2); // 3e62 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3e64, 2); // 3e63 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3e65, 2); // 3e64 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3e66, 2); // 3e65 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3e67, 2); // 3e66 lsr a
        if (regs.fZ) { m.step(0x3e84, 3); label = 0x3e84; continue; } // 3e67 beq $3e84
        m.step(0x3e69, 2);
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x3e6a, 2); // 3e69 tax
        regs.cmp(0x06); m.step(0x3e6c, 2); // 3e6a cmp #$06
        if (regs.fC) { m.step(0x3e84, 3); label = 0x3e84; continue; } // 3e6c bcs $3e84
        m.step(0x3e6e, 2);
        { const a = (0x3fd8 + regs.x) & 0xffff; regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0x3e71, 4 + ((0x3fd8 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
        m.step(0x3e74, 6); m.call(0x3836); // 3e71 jsr $3836
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3e76, 2);
        m.step(0x3e79, 6); m.call(0x3836); // 3e76 jsr $3836
        regs.a = 0x21; regs.setNZ(regs.a); m.step(0x3e7b, 2);
        regs.cpx(0x03); m.step(0x3e7d, 2); // 3e7b cpx #$03
        if (regs.fNZ) { m.step(0x3e81, 3); label = 0x3e81; continue; } // 3e7d bne $3e81
        m.step(0x3e7f, 2);
        regs.a = 0x22; regs.setNZ(regs.a); m.step(0x3e81, 2);
        label = 0x3e81; continue;
      }
      case 0x3e81: {
        m.step(0x3e84, 6); m.call(0x3836); // 3e81 jsr $3836
        label = 0x3e84; continue;
      }
      case 0x3e84: {
        regs.a = 0x3f; regs.setNZ(regs.a); m.step(0x3e86, 2);
        mem.write8(0x0094, regs.a); m.step(0x3e88, 3);
        regs.a = 0xee; regs.setNZ(regs.a); m.step(0x3e8a, 2);
        regs.bit(mem.read8(0x0800)); m.step(0x3e8d, 4); // 3e8a bit $0800
        if (regs.fNV) { m.step(0x3e91, 3); label = 0x3e91; continue; } // 3e8d bvc $3e91
        m.step(0x3e8f, 2);
        regs.a = 0xf2; regs.setNZ(regs.a); m.step(0x3e91, 2);
        label = 0x3e91; continue;
      }
      case 0x3e91: {
        mem.write8(0x0093, regs.a); m.step(0x3e93, 3);
        regs.a = 0x35; regs.setNZ(regs.a); m.step(0x3e95, 2);
        mem.write8(0x0091, regs.a); m.step(0x3e97, 3);
        m.step(0x3e9a, 6); m.call(0x3825); // 3e97 jsr $3825
        regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x3e9d, 4);
        mem.write8(0x00df, regs.a); m.step(0x3e9f, 3);
        regs.a = mem.read8(0x0800); regs.setNZ(regs.a); m.step(0x3ea2, 4);
        mem.write8(0x00dd, regs.a); m.step(0x3ea4, 3);
        regs.a = mem.read8(0x0801); regs.setNZ(regs.a); m.step(0x3ea7, 4);
        mem.write8(0x00de, regs.a); m.step(0x3ea9, 3);
        regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0x3eac, 4);
        regs.and(0x8f); m.step(0x3eae, 2); // 3eac and #$8f
        mem.write8(0x00e0, regs.a); m.step(0x3eb0, 3);
        regs.a = mem.read8(0x0c02); regs.setNZ(regs.a); m.step(0x3eb3, 4);
        regs.and(0x8f); m.step(0x3eb5, 2); // 3eb3 and #$8f
        mem.write8(0x00e1, regs.a); m.step(0x3eb7, 3);
        regs.a = mem.read8(0x0c03); regs.setNZ(regs.a); m.step(0x3eba, 4);
        mem.write8(0x00e2, regs.a); m.step(0x3ebc, 3);
        regs.a = mem.read8(0x100a); regs.setNZ(regs.a); m.step(0x3ebf, 4);
        m.push8(regs.a); m.step(0x3ec0, 3); // 3ebf pha
        regs.and(mem.read8(0x00e3)); m.step(0x3ec2, 3); // 3ec0 and $e3
        mem.write8(0x00e3, regs.a); m.step(0x3ec4, 3);
        regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x3ec5, 4); // 3ec4 pla
        regs.ora(mem.read8(0x00e4)); m.step(0x3ec7, 3); // 3ec5 ora $e4
        mem.write8(0x00e4, regs.a); m.step(0x3ec9, 3);
        regs.x = 0x00; regs.setNZ(regs.x); m.step(0x3ecb, 2); // 3ec9 ldx #$00
        regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x3ece, 4);
        regs.sec(); m.step(0x3ecf, 2); // 3ece sec
        regs.a = regs.rol(regs.a); m.step(0x3ed0, 2); // 3ecf rol a
        label = 0x3ed0; continue;
      }
      case 0x3ed0: {
        if (regs.fC) { m.step(0x3ed3, 3); label = 0x3ed3; continue; } // 3ed0 bcs $3ed3
        m.step(0x3ed2, 2);
        regs.x = regs.inc8(regs.x); m.step(0x3ed3, 2); // 3ed2 inx
        label = 0x3ed3; continue;
      }
      case 0x3ed3: {
        regs.a = regs.asl(regs.a); m.step(0x3ed4, 2); // 3ed3 asl a
        if (regs.fNZ) { m.step(0x3ed0, 3); label = 0x3ed0; continue; } // 3ed4 bne $3ed0
        m.step(0x3ed6, 2);
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3ed7, 2); // 3ed6 txa
        regs.y = mem.read8(0x00e6); regs.setNZ(regs.y); m.step(0x3ed9, 3); // 3ed7 ldy $e6
        regs.a = regs.asl(regs.a); m.step(0x3eda, 2); // 3ed9 asl a
        regs.a = regs.asl(regs.a); m.step(0x3edb, 2); // 3eda asl a
        regs.a = regs.asl(regs.a); m.step(0x3edc, 2); // 3edb asl a
        mem.write8((0x1000 + regs.y) & 0xffff, regs.a); m.step(0x3edf, 5);
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3ee0, 2); // 3edf txa
        regs.ora(0xa0); m.step(0x3ee2, 2); // 3ee0 ora #$a0
        mem.write8((0x1001 + regs.y) & 0xffff, regs.a); m.step(0x3ee5, 5);
        regs.x = mem.read8(0x00e7); regs.setNZ(regs.x); m.step(0x3ee7, 3); // 3ee5 ldx $e7
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x3ee9, 2); // 3ee7 ldy #$00
        regs.a = mem.read8(0x00b9); regs.setNZ(regs.a); m.step(0x3eeb, 3);
        mem.write8(0x00b9, regs.y); m.step(0x3eed, 3); // 3eeb sty $b9
        regs.clc(); m.step(0x3eee, 2); // 3eed clc
        regs.adc(mem.read8((0x0054 + regs.x) & 0xff)); m.step(0x3ef0, 4); // 3eee adc $54,x
        mem.write8((0x0054 + regs.x) & 0xff, regs.a); m.step(0x3ef2, 4);
        regs.a = mem.read8((0x0064 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x3ef4, 4);
        regs.sec(); m.step(0x3ef5, 2); // 3ef4 sec
        regs.sbc(mem.read8(0x00bb)); m.step(0x3ef7, 3); // 3ef5 sbc $bb
        mem.write8(0x00bb, regs.y); m.step(0x3ef9, 3); // 3ef7 sty $bb
        mem.write8((0x0064 + regs.x) & 0xff, regs.a); m.step(0x3efb, 4);
        regs.y = 0xd0; regs.setNZ(regs.y); m.step(0x3efd, 2); // 3efb ldy #$d0
        regs.x = 0x05; regs.setNZ(regs.x); m.step(0x3eff, 2); // 3efd ldx #$05
        label = 0x3eff; continue;
      }
      case 0x3eff: {
        regs.s = regs.x; m.step(0x3f00, 2); // 3eff txs
        regs.x = 0x07; regs.setNZ(regs.x); m.step(0x3f02, 2); // 3f00 ldx #$07
        label = 0x3f02; continue;
      }
      case 0x3f02: {
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3f03, 2); // 3f02 txa
        regs.x = regs.s; regs.setNZ(regs.x); m.step(0x3f04, 2); // 3f03 tsx
        mem.write8((0x00dd + regs.x) & 0xff, regs.rol(mem.read8((0x00dd + regs.x) & 0xff))); m.step(0x3f06, 6); // 3f04 rol $dd,x
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x3f07, 2); // 3f06 tax
        regs.a = 0x21; regs.setNZ(regs.a); m.step(0x3f09, 2);
        if (regs.fC) { m.step(0x3f0d, 3); label = 0x3f0d; continue; } // 3f09 bcs $3f0d
        m.step(0x3f0b, 2);
        regs.a = 0x20; regs.setNZ(regs.a); m.step(0x3f0d, 2);
        label = 0x3f0d; continue;
      }
      case 0x3f0d: {
        regs.y = regs.inc8(regs.y); m.step(0x3f0e, 2); // 3f0d iny
        mem.write8((0x0400 + regs.y) & 0xffff, regs.a); m.step(0x3f11, 5);
        regs.x = regs.dec8(regs.x); m.step(0x3f12, 2); // 3f11 dex
        if (regs.fPl) { m.step(0x3f02, 3); label = 0x3f02; continue; } // 3f12 bpl $3f02
        m.step(0x3f14, 2);
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x3f15, 2); // 3f14 tya
        regs.sec(); m.step(0x3f16, 2); // 3f15 sec
        regs.sbc(0x28); m.step(0x3f18, 2); // 3f16 sbc #$28
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x3f19, 2); // 3f18 tay
        regs.x = regs.s; regs.setNZ(regs.x); m.step(0x3f1a, 2); // 3f19 tsx
        regs.x = regs.dec8(regs.x); m.step(0x3f1b, 2); // 3f1a dex
        if (regs.fPl) { m.step(0x3eff, 4); label = 0x3eff; continue; } // 3f1b bpl $3eff (page-cross)
        m.step(0x3f1d, 2);
        regs.a = 0x04; regs.setNZ(regs.a); m.step(0x3f1f, 2);
        mem.write8(0x0092, regs.a); m.step(0x3f21, 3);
        regs.a = 0x3a; regs.setNZ(regs.a); m.step(0x3f23, 2);
        mem.write8(0x0091, regs.a); m.step(0x3f25, 3);
        regs.a = mem.read8(0x00e4); regs.setNZ(regs.a); m.step(0x3f27, 3);
        regs.eor(0xff); m.step(0x3f29, 2); // 3f27 eor #$ff
        regs.ora(mem.read8(0x00e3)); m.step(0x3f2b, 3); // 3f29 ora $e3
        regs.ora(mem.read8(0x00e5)); m.step(0x3f2d, 3); // 3f2b ora $e5
        if (regs.fZ) { m.step(0x3f31, 3); label = 0x3f31; continue; } // 3f2d beq $3f31
        m.step(0x3f2f, 2);
        regs.a = 0x25; regs.setNZ(regs.a); m.step(0x3f31, 2);
        label = 0x3f31; continue;
      }
      case 0x3f31: {
        m.step(0x3f34, 6); m.call(0x3836); // 3f31 jsr $3836
        m.step(0x3f37, 6); m.call(0x3ac0); // 3f34 jsr $3ac0
        m.step(0x3f3a, 6); m.call(0x3a08); // 3f37 jsr $3a08
        mem.write8(0x01b5, regs.y); m.step(0x3f3d, 4); // 3f3a sty $01b5
        if (regs.fZ) { m.step(0x3f55, 3); label = 0x3f55; continue; } // 3f3d beq $3f55
        m.step(0x3f3f, 2);
        m.push8(regs.a); m.step(0x3f40, 3); // 3f3f pha
        regs.a = 0x3b; regs.setNZ(regs.a); m.step(0x3f42, 2);
        mem.write8(0x0091, regs.a); m.step(0x3f44, 3);
        regs.a = 0x24; regs.setNZ(regs.a); m.step(0x3f46, 2);
        m.step(0x3f49, 6); m.call(0x3836); // 3f46 jsr $3836
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3f4b, 2);
        m.step(0x3f4e, 6); m.call(0x3836); // 3f4b jsr $3836
        regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x3f4f, 4); // 3f4e pla
        m.step(0x3f52, 6); m.call(0x384f); // 3f4f jsr $384f
        m.step(0x3fd6, 3); return m.call(0x3fd6); // 3f52 jmp $3fd6
      }
      case 0x3f55: {
        regs.a = 0x04; regs.setNZ(regs.a); m.step(0x3f57, 2);
        mem.write8(0x0092, regs.a); m.step(0x3f59, 3);
        regs.a = 0xe9; regs.setNZ(regs.a); m.step(0x3f5b, 2);
        mem.write8(0x0091, regs.a); m.step(0x3f5d, 3);
        regs.sec(); m.step(0x3f5e, 2); // 3f5d sec
        regs.a = mem.read8(0x018d); regs.setNZ(regs.a); m.step(0x3f61, 4);
        m.step(0x3f64, 6); m.call(0x384f); // 3f61 jsr $384f
        regs.a = mem.read8(0x018c); regs.setNZ(regs.a); m.step(0x3f67, 4);
        m.step(0x3f6a, 6); m.call(0x384f); // 3f67 jsr $384f
        regs.a = mem.read8(0x018b); regs.setNZ(regs.a); m.step(0x3f6d, 4);
        regs.clc(); m.step(0x3f6e, 2); // 3f6d clc
        m.step(0x3f71, 6); m.call(0x384f); // 3f6e jsr $384f
        regs.a = 0xde; regs.setNZ(regs.a); m.step(0x3f73, 2);
        mem.write8(0x0093, regs.a); m.step(0x3f75, 3);
        regs.a = 0x3f; regs.setNZ(regs.a); m.step(0x3f77, 2);
        mem.write8(0x0094, regs.a); m.step(0x3f79, 3);
        m.step(0x3f7c, 6); m.call(0x3825); // 3f79 jsr $3825
        regs.a = 0x05; regs.setNZ(regs.a); m.step(0x3f7e, 2);
        mem.write8(0x0092, regs.a); m.step(0x3f80, 3);
        regs.a = 0x08; regs.setNZ(regs.a); m.step(0x3f82, 2);
        mem.write8(0x0091, regs.a); m.step(0x3f84, 3);
        regs.a = mem.read8(0x008d); regs.setNZ(regs.a); m.step(0x3f86, 3);
        regs.a = regs.lsr(regs.a); m.step(0x3f87, 2); // 3f86 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3f88, 2); // 3f87 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3f89, 2); // 3f88 lsr a
        regs.a = regs.lsr(regs.a); m.step(0x3f8a, 2); // 3f89 lsr a
        regs.sed(); m.step(0x3f8b, 2); // 3f8a sed
        regs.clc(); m.step(0x3f8c, 2); // 3f8b clc
        regs.adc(0x00); m.step(0x3f8e, 2); // 3f8c adc #$00
        regs.cld(); m.step(0x3f8f, 2); // 3f8e cld
        regs.sec(); m.step(0x3f90, 2); // 3f8f sec
        m.step(0x3f93, 6); m.call(0x384f); // 3f90 jsr $384f
        regs.a = 0x2e; regs.setNZ(regs.a); m.step(0x3f95, 2);
        m.step(0x3f98, 6); m.call(0x3836); // 3f95 jsr $3836
        regs.a = mem.read8(0x008d); regs.setNZ(regs.a); m.step(0x3f9a, 3);
        regs.and(0x0f); m.step(0x3f9c, 2); // 3f9a and #$0f
        regs.sed(); m.step(0x3f9d, 2); // 3f9c sed
        regs.clc(); m.step(0x3f9e, 2); // 3f9d clc
        regs.adc(0x00); m.step(0x3fa0, 2); // 3f9e adc #$00
        mem.write8(0x008e, regs.a); m.step(0x3fa2, 3);
        regs.adc(mem.read8(0x008e)); m.step(0x3fa4, 3); // 3fa2 adc $8e
        mem.write8(0x008e, regs.a); m.step(0x3fa6, 3);
        regs.adc(mem.read8(0x008e)); m.step(0x3fa8, 3); // 3fa6 adc $8e
        regs.cld(); m.step(0x3fa9, 2); // 3fa8 cld
        regs.cmp(0x60); m.step(0x3fab, 2); // 3fa9 cmp #$60
        if (regs.fNC) { m.step(0x3faf, 3); label = 0x3faf; continue; } // 3fab bcc $3faf
        m.step(0x3fad, 2);
        regs.a = 0x59; regs.setNZ(regs.a); m.step(0x3faf, 2);
        label = 0x3faf; continue;
      }
      case 0x3faf: {
        regs.clc(); m.step(0x3fb0, 2); // 3faf clc
        m.step(0x3fb3, 6); m.call(0x384f); // 3fb0 jsr $384f
        regs.a = 0xe4; regs.setNZ(regs.a); m.step(0x3fb5, 2);
        mem.write8(0x0093, regs.a); m.step(0x3fb7, 3);
        regs.a = 0x3f; regs.setNZ(regs.a); m.step(0x3fb9, 2);
        mem.write8(0x0094, regs.a); m.step(0x3fbb, 3);
        m.step(0x3fbe, 6); m.call(0x3825); // 3fbb jsr $3825
        regs.a = mem.read8(0x00ea); regs.setNZ(regs.a); m.step(0x3fc0, 3);
        regs.ora(mem.read8(0x00eb)); m.step(0x3fc2, 3); // 3fc0 ora $eb
        regs.ora(mem.read8(0x00ec)); m.step(0x3fc4, 3); // 3fc2 ora $ec
        if (regs.fNZ) { m.step(0x3fd6, 3); return m.call(0x3fd6); } // 3fc4 bne $3fd6
        m.step(0x3fc6, 2);
        regs.a = mem.read8(0x01b5); regs.setNZ(regs.a); m.step(0x3fc9, 4);
        regs.eor(0xff); m.step(0x3fcb, 2); // 3fc9 eor #$ff
        mem.write8(0x01b5, regs.a); m.step(0x3fce, 4);
        regs.a = 0x3d; regs.setNZ(regs.a); m.step(0x3fd0, 2);
        mem.write8(0x00f9, regs.a); m.step(0x3fd2, 3);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3fd4, 2);
        mem.write8(0x00fa, regs.a); m.step(0x3fd6, 3);
        return m.call(0x3fd6); // fall into loc_3fd6
      }
    }
  }
}
