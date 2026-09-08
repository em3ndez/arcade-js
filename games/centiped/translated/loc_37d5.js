// SPDX-License-Identifier: GPL-3.0-only
// loc_37d5 (ROM 0x37d5-0x3825) -- walks a 0x346D pointer-table row and emits each byte through the $3836 sub.
export function loc_37d5(m) {
  return runFrom(m, 0x37d5);
}

// Second entry at 0x3801 (the `sty $8b` inside the draw loop): loc_3825's always-taken BEQ re-enters
// here with Y already 0, so the 0x37ff `ldy #$04` is not re-run.
export function loc_3801(m) {
  const { regs, mem } = m;
  mem.write8(0x008b, regs.y); m.step(0x3803, 3); // 3801 sty $8b
  return runFrom(m, 0x3803);
}

function runFrom(m, label) {
  const { regs, mem } = m;
  for (;;) {
    switch (label) {
      case 0x37d5: {
        regs.a = regs.asl(regs.a); m.step(0x37d6, 2); // 37d5 asl a
        mem.write8(0x008c, regs.ror(mem.read8(0x008c))); m.step(0x37d8, 5); // 37d6 ror $8c
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x37d9, 2); // 37d8 tay
        regs.a = regs.asl(regs.a); m.step(0x37da, 2); // 37d9 asl a
        mem.write8(0x008b, regs.a); m.step(0x37dc, 3); // 37da sta $8b
        regs.a = mem.read8(0x00fd); regs.setNZ(regs.a); m.step(0x37de, 3); // 37dc lda $fd
        regs.and(0x03); m.step(0x37e0, 2); // 37de and #$03
        regs.ora(mem.read8(0x008b)); m.step(0x37e2, 3); // 37e0 ora $8b
        regs.a = regs.asl(regs.a); m.step(0x37e3, 2); // 37e2 asl a
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x37e4, 2); // 37e3 tax
        { const a = (0x346d + regs.x) & 0xffff; regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0x37e7, 4 + (((0x346d & 0xff00) !== (a & 0xff00)) ? 1 : 0)); } // 37e4 lda $346d,x
        mem.write8(0x0093, regs.a); m.step(0x37e9, 3); // 37e7 sta $93
        { const a = (0x346e + regs.x) & 0xffff; regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0x37ec, 4 + (((0x346e & 0xff00) !== (a & 0xff00)) ? 1 : 0)); } // 37e9 lda $346e,x
        mem.write8(0x0094, regs.a); m.step(0x37ee, 3); // 37ec sta $94
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x37f0, 2); // 37ee ldy #$00
        regs.x = mem.read8(0x00ef); regs.setNZ(regs.x); m.step(0x37f2, 3); // 37f0 ldx $ef
        if (regs.fZ) { // 37f2 beq $37f6
          m.step(0x37f6, 3); label = 0x37f6; continue;
        }
        m.step(0x37f4, 2);
        regs.y = 0x02; regs.setNZ(regs.y); m.step(0x37f6, 2); // 37f4 ldy #$02
        label = 0x37f6; continue;
      }
      case 0x37f6: {
        { const b = mem.read16(0x0093); const a = (b + regs.y) & 0xffff; regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0x37f8, 5 + (((b & 0xff00) !== (a & 0xff00)) ? 1 : 0)); } // 37f6 lda ($93),y
        mem.write8(0x0091, regs.a); m.step(0x37fa, 3); // 37f8 sta $91
        regs.y = regs.inc8(regs.y); m.step(0x37fb, 2); // 37fa iny
        { const b = mem.read16(0x0093); const a = (b + regs.y) & 0xffff; regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0x37fd, 5 + (((b & 0xff00) !== (a & 0xff00)) ? 1 : 0)); } // 37fb lda ($93),y
        mem.write8(0x0092, regs.a); m.step(0x37ff, 3); // 37fd sta $92
        regs.y = 0x04; regs.setNZ(regs.y); m.step(0x3801, 2); // 37ff ldy #$04
        mem.write8(0x008b, regs.y); m.step(0x3803, 3); // 3801 sty $8b
        label = 0x3803; continue;
      }
      case 0x3803: {
        regs.y = mem.read8(0x008b); regs.setNZ(regs.y); m.step(0x3805, 3); // 3803 ldy $8b
        { const b = mem.read16(0x0093); const a = (b + regs.y) & 0xffff; regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0x3807, 5 + (((b & 0xff00) !== (a & 0xff00)) ? 1 : 0)); } // 3805 lda ($93),y
        regs.and(0x3f); m.step(0x3809, 2); // 3807 and #$3f
        regs.cmp(0x20); m.step(0x380b, 2); // 3809 cmp #$20
        if (regs.fZ) { // 380b beq $3811
          m.step(0x3811, 3); label = 0x3811; continue;
        }
        m.step(0x380d, 2);
        regs.x = mem.read8(0x008c); regs.setNZ(regs.x); m.step(0x380f, 3); // 380d ldx $8c
        if (regs.fPl) { // 380f bpl $3813
          m.step(0x3813, 3); label = 0x3813; continue;
        }
        m.step(0x3811, 2);
        label = 0x3811; continue;
      }
      case 0x3811: {
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x3813, 2); // 3811 lda #$00
        label = 0x3813; continue;
      }
      case 0x3813: {
        regs.cmp(0x30); m.step(0x3815, 2); // 3813 cmp #$30
        if (regs.fNC) { // 3815 bcc $3819
          m.step(0x3819, 3); label = 0x3819; continue;
        }
        m.step(0x3817, 2);
        regs.and(0x2f); m.step(0x3819, 2); // 3817 and #$2f
        label = 0x3819; continue;
      }
      case 0x3819: {
        m.push16(0x381b); m.step(0x381c, 6); m.call(0x3836); // 3819 jsr $3836
        regs.y = mem.read8(0x008b); regs.setNZ(regs.y); m.step(0x381e, 3); // 381c ldy $8b
        mem.write8(0x008b, regs.inc8(mem.read8(0x008b))); m.step(0x3820, 5); // 381e inc $8b
        { const b = mem.read16(0x0093); const a = (b + regs.y) & 0xffff; regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0x3822, 5 + (((b & 0xff00) !== (a & 0xff00)) ? 1 : 0)); } // 3820 lda ($93),y
        if (regs.fPl) { // 3822 bpl $3803
          m.step(0x3803, 3); label = 0x3803; continue;
        }
        m.step(0x3824, 2);
        label = 0x3824; continue;
      }
      case 0x3824: {
        return m.ret(6); // 3824 rts
      }
    }
  }
}
