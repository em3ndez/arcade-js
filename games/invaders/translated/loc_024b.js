// SPDX-License-Identifier: GPL-3.0-only
// loc_024b (ROM 0x024b-0x028b) -- table walker over 16-byte records from HL (0x2010 via loc_0248):
// 0xff -> ret, 0xfe -> skip; else test a 16-bit field + gate byte, edit record in place or dispatch via pchl @ 0x026e (rule 10 gap).
export function loc_024b(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.a = mem.read8(regs.hl); m.step(0x024c, 7);         // 024b  mov a,m
    regs.cp(0xff); m.step(0x024e, 7);                       // 024c  cpi 0xff
    if (regs.fZ) { return m.ret(11); }
    m.step(0x024f, 5);
    regs.cp(0xfe); m.step(0x0251, 7);                       // 024f  cpi 0xfe
    if (regs.fNZ) {
      m.step(0x0254, 10);
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0255, 5);  // 0254  inx h
      regs.b = mem.read8(regs.hl); m.step(0x0256, 7);       // 0255  mov b,m
      regs.c = regs.a; m.step(0x0257, 5);                   // 0256  mov c,a
      regs.or(regs.b); m.step(0x0258, 4);                   // 0257  ora b
      regs.a = regs.c; m.step(0x0259, 5);                   // 0258  mov a,c
      if (regs.fNZ) {
        m.step(0x0277, 10);
        regs.b = regs.dec8(regs.b); m.step(0x0278, 5);      // 0277  dcr b
        regs.b = regs.inc8(regs.b); m.step(0x0279, 5);      // 0278  inr b
        if (regs.fNZ) {
          m.step(0x027d, 10);
        } else {
          m.step(0x027c, 10);
          regs.a = regs.dec8(regs.a); m.step(0x027d, 5);    // 027c  dcr a
        }
        regs.b = regs.dec8(regs.b); m.step(0x027e, 5);      // 027d  dcr b
        mem.write8(regs.hl, regs.b); m.step(0x027f, 7);     // 027e  mov m,b
        regs.hl = (regs.hl - 1) & 0xffff; m.step(0x0280, 5);// 027f  dcx h
        mem.write8(regs.hl, regs.a); m.step(0x0281, 7);     // 0280  mov m,a
      } else {
        m.step(0x025c, 10);
        regs.hl = (regs.hl + 1) & 0xffff; m.step(0x025d, 5);// 025c  inx h
        regs.a = mem.read8(regs.hl); m.step(0x025e, 7);     // 025d  mov a,m
        regs.and(regs.a); m.step(0x025f, 4);                // 025e  ana a
        if (regs.fNZ) {
          m.step(0x0288, 10);
          regs.decMem8(mem, regs.hl); m.step(0x0289, 10);   // 0288  dcr m
          regs.hl = (regs.hl - 1) & 0xffff; m.step(0x028a, 5);// 0289  dcx h
          regs.hl = (regs.hl - 1) & 0xffff; m.step(0x028b, 5);// 028a  dcx h
          m.step(0x0281, 10);                               // 028b  jmp 0x0281
        } else {
          m.step(0x0262, 10);
          regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0263, 5);// 0262  inx h
          regs.e = mem.read8(regs.hl); m.step(0x0264, 7);   // 0263  mov e,m
          regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0265, 5);// 0264  inx h
          regs.d = mem.read8(regs.hl); m.step(0x0266, 7);   // 0265  mov d,m
          m.push16(regs.hl); m.step(0x0267, 11);            // 0266  push h
          regs.exDeHl(); m.step(0x0268, 4);                 // 0267  xchg
          m.push16(regs.hl); m.step(0x0269, 11);            // 0268  push h
          regs.hl = 0x026f; m.step(0x026c, 10);             // 0269  lxi h,0x026f
          const t = mem.read16(regs.sp); mem.write16(regs.sp, regs.hl); regs.hl = t; m.step(0x026d, 18); // 026c  xthl
          m.push16(regs.de); m.step(0x026e, 11);            // 026d  push d
          throw new Error("pchl @ 0x026e: computed-jump targets need a MAME exec-trace (batch-1 gap)");
        }
      }
    } else {
      m.step(0x0281, 10);
    }
    regs.de = 0x0010; m.step(0x0284, 10);                   // 0281  lxi d,0x0010
    regs.addHl(regs.de); m.step(0x0285, 10);                // 0284  dad d
    m.step(0x024b, 10);                                     // 0285  jmp 0x024b (loop)
  }
}
