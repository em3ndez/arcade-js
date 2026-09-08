// SPDX-License-Identifier: GPL-3.0-only
// loc_3871  (ROM 0x3871-0x3955) -- IRQ-handler front block: saves A/X/Y, kicks the coin latch on $d2, and on
// the 32V (BIT $0c00) beat bumps the frame/BCD-timer counters, then indexes the two trackball readers
// (loc_39ea), calls loc_382d/loc_2656, and refreshes the $07d0/$07e0 object shadow before falling into
// loc_3956. Exits: JMP loc_396d, JMP loc_3956, fall into loc_3956. (38a8/38ae BCS-to-self = watchdog hangs.)
// loc_3907 is a second entry into this same machine at 0x3907 (lda $64,x); its caller (loc_3956) supplies X.
function run3871(m, label) {
  const { regs, mem } = m;
  for (;;) {
    switch (label) {
      case 0x3871: {
        m.push8(regs.a); m.step(0x3872, 3);
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x3873, 2);
        m.push8(regs.a); m.step(0x3874, 3);
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x3875, 2);
        m.push8(regs.a); m.step(0x3876, 3);
        regs.cld(); m.step(0x3877, 2);
        regs.a = mem.read8(0x00d2); regs.setNZ(regs.a); m.step(0x3879, 3);              // 3877 lda $d2
        if (regs.fZ) { m.step(0x3885, 3); label = 0x3885; continue; }                   // 3879 beq $3885
        m.step(0x387b, 2);
        regs.a = 0x10; regs.setNZ(regs.a); m.step(0x387d, 2);
        mem.write8(0x1002, regs.a); m.step(0x3880, 4);
        regs.a = 0xaf; regs.setNZ(regs.a); m.step(0x3882, 2);
        mem.write8(0x1003, regs.a); m.step(0x3885, 4);
        label = 0x3885; continue;
      }
      case 0x3885: {
        regs.bit(mem.read8(0x0c00)); m.step(0x3888, 4);                                 // 3885 bit $0c00
        if (regs.fV) { m.step(0x388d, 3); label = 0x388d; continue; }                   // 3888 bvs $388d
        m.step(0x388a, 2);
        m.step(0x396d, 3); return m.call(0x396d);                                       // 388a jmp $396d
      }
      case 0x388d: {
        mem.write8(0x008a, regs.inc8(mem.read8(0x008a))); m.step(0x388f, 5);            // 388d inc $8a
        mem.write8(0x0000, regs.inc8(mem.read8(0x0000))); m.step(0x3891, 5);
        if (regs.fNZ) { m.step(0x38a4, 3); label = 0x38a4; continue; }                  // 3891 bne $38a4
        m.step(0x3893, 2);
        mem.write8(0x0001, regs.inc8(mem.read8(0x0001))); m.step(0x3895, 5);
        regs.sed(); m.step(0x3896, 2);
        regs.a = mem.read8(0x00fb); regs.setNZ(regs.a); m.step(0x3898, 3);
        regs.clc(); m.step(0x3899, 2);
        regs.adc(0x01); m.step(0x389b, 2);
        mem.write8(0x00fb, regs.a); m.step(0x389d, 3);
        regs.a = mem.read8(0x00fc); regs.setNZ(regs.a); m.step(0x389f, 3);
        regs.adc(0x00); m.step(0x38a1, 2);
        mem.write8(0x00fc, regs.a); m.step(0x38a3, 3);
        regs.cld(); m.step(0x38a4, 2);
        label = 0x38a4; continue;
      }
      case 0x38a4: {
        regs.a = mem.read8(0x008a); regs.setNZ(regs.a); m.step(0x38a6, 3);              // 38a4 lda $8a
        regs.cmp(0x08); m.step(0x38a8, 2);
        while (regs.fC) { m.step(0x38a8, 3); }                                          // 38a8 bcs $38a8 (spin: watchdog hang if $8a >= 8)
        m.step(0x38aa, 2);
        regs.a = mem.read8(0x00c8); regs.setNZ(regs.a); m.step(0x38ac, 3);
        regs.cmp(0x25); m.step(0x38ae, 2);
        while (regs.fC) { m.step(0x38ae, 3); }                                          // 38ae bcs $38ae (spin: watchdog hang if $c8 >= 0x25)
        m.step(0x38b0, 2);
        regs.cmp(0x13); m.step(0x38b2, 2);
        if (regs.fNC) { m.step(0x38b8, 3); label = 0x38b8; continue; }                  // 38b2 bcc $38b8
        m.step(0x38b4, 2);
        regs.a = 0x12; regs.setNZ(regs.a); m.step(0x38b6, 2);
        mem.write8(0x00c8, regs.a); m.step(0x38b8, 3);
        label = 0x38b8; continue;
      }
      case 0x38b8: {
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x38ba, 3);              // 38b8 ldx $88
        regs.a = mem.read8(0x0c03); regs.setNZ(regs.a); m.step(0x38bd, 4);
        regs.cpx(0x02); m.step(0x38bf, 2);
        if (regs.fNZ) { m.step(0x38c5, 3); label = 0x38c5; continue; }                  // 38bf bne $38c5
        m.step(0x38c1, 2);
        regs.a = regs.asl(regs.a); m.step(0x38c2, 2);
        regs.a = regs.asl(regs.a); m.step(0x38c3, 2);
        regs.a = regs.asl(regs.a); m.step(0x38c4, 2);
        regs.a = regs.asl(regs.a); m.step(0x38c5, 2);
        label = 0x38c5; continue;
      }
      case 0x38c5: {
        regs.y = mem.read8(0x01b8); regs.setNZ(regs.y); m.step(0x38c8, 4);              // 38c5 ldy $01b8
        m.step(0x38cb, 6); m.call(0x39ea);                                             // 38c8 jsr $39ea
        mem.write8(0x01b8, regs.y); m.step(0x38ce, 4);
        m.push8(regs.a); m.step(0x38cf, 3);
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x38d0, 2);
        regs.clc(); m.step(0x38d1, 2);
        regs.adc(mem.read8(0x00b9)); m.step(0x38d3, 3);
        mem.write8(0x00b9, regs.a); m.step(0x38d5, 3);
        regs.a = m.pull8(); regs.setNZ(regs.a); m.step(0x38d6, 4);
        regs.y = mem.read8(0x01b9); regs.setNZ(regs.y); m.step(0x38d9, 4);
        m.step(0x38dc, 6); m.call(0x39ea);                                             // 38d9 jsr $39ea
        mem.write8(0x01b9, regs.y); m.step(0x38df, 4);
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x38e0, 2);
        m.step(0x38e3, 6); m.call(0x382d);                                             // 38e0 jsr $382d
        regs.clc(); m.step(0x38e4, 2);
        regs.adc(mem.read8(0x00bb)); m.step(0x38e6, 3);
        mem.write8(0x00bb, regs.a); m.step(0x38e8, 3);
        regs.a = mem.read8((0x00c2 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x38ea, 4);
        if (regs.fN) { m.step(0x38f4, 3); label = 0x38f4; continue; }                   // 38ea bmi $38f4
        m.step(0x38ec, 2);
        regs.cmp(0x40); m.step(0x38ee, 2);
        if (regs.fNC) { m.step(0x3905, 4); label = 0x3905; continue; }                  // 38ee bcc $3905 (taken: +1 page-cross)
        m.step(0x38f0, 2);
        regs.and(0x3f); m.step(0x38f2, 2);
        if (regs.fPl) { m.step(0x38ff, 3); label = 0x38ff; continue; }                  // 38f2 bpl $38ff
        m.step(0x38f4, 2);
        label = 0x38f4; continue;
      }
      case 0x38f4: {
        regs.and(0x3f); m.step(0x38f6, 2);                                              // 38f4 and #$3f
        regs.clc(); m.step(0x38f7, 2);
        regs.adc(0x03); m.step(0x38f9, 2);
        regs.cmp(0x2a); m.step(0x38fb, 2);
        if (regs.fNC) { m.step(0x38ff, 3); label = 0x38ff; continue; }                  // 38fb bcc $38ff
        m.step(0x38fd, 2);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x38ff, 2);
        label = 0x38ff; continue;
      }
      case 0x38ff: {
        mem.write8((0x00c2 + regs.x) & 0xff, regs.a); m.step(0x3901, 4);                // 38ff sta $c2,x
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x3902, 2);
        m.step(0x3905, 6); m.call(0x2656);                                             // 3902 jsr $2656
        label = 0x3905; continue;
      }
      case 0x3905: {
        regs.x = 0x0f; regs.setNZ(regs.x); m.step(0x3907, 2);                           // 3905 ldx #$0f
        label = 0x3907; continue;
      }
      case 0x3907: {
        regs.a = mem.read8((0x0064 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x3909, 4); // 3907 lda $64,x
        mem.write8((0x07e0 + regs.x) & 0xffff, regs.a); m.step(0x390c, 5);
        regs.a = mem.read8((0x0054 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x390e, 4);
        regs.y = 0x00; regs.setNZ(regs.y); m.step(0x3910, 2);
        regs.cpx(0x0d); m.step(0x3912, 2);
        if (regs.fZ) { m.step(0x391b, 3); label = 0x391b; continue; }                   // 3912 beq $391b
        m.step(0x3914, 2);
        regs.y = mem.read8((0x0044 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x3916, 4);
        if (regs.fPl) { m.step(0x391b, 3); label = 0x391b; continue; }                  // 3916 bpl $391b
        m.step(0x3918, 2);
        regs.clc(); m.step(0x3919, 2);
        regs.adc(0x01); m.step(0x391b, 2);
        label = 0x391b; continue;
      }
      case 0x391b: {
        mem.write8((0x07d0 + regs.x) & 0xffff, regs.a); m.step(0x391e, 5);              // 391b sta $07d0,x
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x391f, 2);
        regs.and(0x80); m.step(0x3921, 2);
        mem.write8(0x0099, regs.a); m.step(0x3923, 3);
        regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0x3926, 4);
        regs.and(0x20); m.step(0x3928, 2);
        if (regs.fNZ) { m.step(0x392f, 3); label = 0x392f; continue; }                  // 3928 bne $392f
        m.step(0x392a, 2);
        regs.a = mem.read8((0x0034 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x392c, 4);
        m.step(0x3956, 3); return m.call(0x3956);                                       // 392c jmp $3956
      }
      case 0x392f: {
        regs.a = mem.read8((0x0034 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x3931, 4); // 392f lda $34,x
        regs.cpx(0x0c); m.step(0x3933, 2);
        if (regs.fC) { m.step(0x3954, 3); label = 0x3954; continue; }                   // 3933 bcs $3954
        m.step(0x3935, 2);
        regs.and(0x3f); m.step(0x3937, 2);
        regs.cmp(0x30); m.step(0x3939, 2);
        if (regs.fC) { m.step(0x3954, 3); label = 0x3954; continue; }                   // 3939 bcs $3954
        m.step(0x393b, 2);
        regs.and(0x0f); m.step(0x393d, 2);
        mem.write8(0x0098, regs.a); m.step(0x393f, 3);
        regs.a = mem.read8((0x0064 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0x3941, 4);
        regs.and(0x07); m.step(0x3943, 2);
        if (regs.fZ) { m.step(0x3952, 3); label = 0x3952; continue; }                   // 3943 beq $3952
        m.step(0x3945, 2);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x3946, 2);
        regs.a = 0x08; regs.setNZ(regs.a); m.step(0x3948, 2);
        regs.cpy(0x06); m.step(0x394a, 2);
        if (regs.fC) { m.step(0x3952, 3); label = 0x3952; continue; }                   // 394a bcs $3952
        m.step(0x394c, 2);
        regs.cpy(0x03); m.step(0x394e, 2);
        if (regs.fNC) { m.step(0x3952, 3); label = 0x3952; continue; }                  // 394e bcc $3952
        m.step(0x3950, 2);
        regs.a = 0x0c; regs.setNZ(regs.a); m.step(0x3952, 2);
        label = 0x3952; continue;
      }
      case 0x3952: {
        regs.eor(mem.read8(0x0098)); m.step(0x3954, 3);                                 // 3952 eor $98
        label = 0x3954; continue;
      }
      case 0x3954: {
        regs.eor(mem.read8(0x0099)); m.step(0x3956, 3);                                 // 3954 eor $99
        return m.call(0x3956);                                                          // fall into loc_3956
      }
    }
  }
}

export function loc_3871(m) { return run3871(m, 0x3871); }
export function loc_3907(m) { return run3871(m, 0x3907); }
