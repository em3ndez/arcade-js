// SPDX-License-Identifier: GPL-3.0-only
// loc_0563 (ROM 0x0563-0x062e) -- CALLed head; interior labels reached ONLY from within, so ONE
// routine, modeled as a `block` dispatch (irreducible backward jmp 0x062c->0x05a5).
export function loc_0563(m) {
  const { regs, mem } = m;
  let block = 0x0563;
  for (;;) {
    switch (block) {
      case 0x0563: {
        regs.hl = 0x2073; m.step(0x0566, 10);                                   // 0563 lxi h,0x2073
        regs.a = mem.read8(regs.hl); m.step(0x0567, 7);                         // 0566 mov a,m
        regs.and(0x80); m.step(0x0569, 7);                                      // 0567 ani 0x80
        if (regs.fNZ) { m.step(0x05c1, 10); block = 0x05c1; break; }
        m.step(0x056c, 10);
        regs.a = mem.read8(0x20c1); m.step(0x056f, 13);                         // 056c lda 0x20c1
        regs.cp(0x04); m.step(0x0571, 7);                                       // 056f cpi 0x04
        regs.a = mem.read8(0x2069); m.step(0x0574, 13);                         // 0571 lda 0x2069
        if (regs.fZ) { m.step(0x05b7, 10); block = 0x05b7; break; }
        m.step(0x0577, 10);
        regs.and(regs.a); m.step(0x0578, 4);                                    // 0577 ana a
        if (regs.fZ) { return m.ret(11); }
        m.step(0x0579, 5);
        regs.hl = (regs.hl + 1) & 0xffff; m.step(0x057a, 5);                    // 0579 inx h
        mem.write8(regs.hl, 0x00); m.step(0x057c, 10);                          // 057a mvi m,0x00
        regs.a = mem.read8(0x2070); m.step(0x057f, 13);                         // 057c lda 0x2070
        regs.and(regs.a); m.step(0x0580, 4);                                    // 057f ana a
        if (regs.fZ) { m.step(0x0589, 10); block = 0x0589; break; }
        m.step(0x0583, 10);
        regs.b = regs.a; m.step(0x0584, 5);                                     // 0583 mov b,a
        regs.a = mem.read8(0x20cf); m.step(0x0587, 13);                         // 0584 lda 0x20cf
        regs.cp(regs.b); m.step(0x0588, 4);                                     // 0587 cmp b
        if (regs.fNC) { return m.ret(11); }
        m.step(0x0589, 5);
        block = 0x0589; break;
      }
      case 0x0589: {
        regs.a = mem.read8(0x2071); m.step(0x058c, 13);                         // 0589 lda 0x2071
        regs.and(regs.a); m.step(0x058d, 4);                                    // 058c ana a
        if (regs.fZ) { m.step(0x0596, 10); block = 0x0596; break; }
        m.step(0x0590, 10);
        regs.b = regs.a; m.step(0x0591, 5);                                     // 0590 mov b,a
        regs.a = mem.read8(0x20cf); m.step(0x0594, 13);                         // 0591 lda 0x20cf
        regs.cp(regs.b); m.step(0x0595, 4);                                     // 0594 cmp b
        if (regs.fNC) { return m.ret(11); }
        m.step(0x0596, 5);
        block = 0x0596; break;
      }
      case 0x0596: {
        regs.hl = (regs.hl + 1) & 0xffff; m.step(0x0597, 5);                    // 0596 inx h
        regs.a = mem.read8(regs.hl); m.step(0x0598, 7);                         // 0597 mov a,m
        regs.and(regs.a); m.step(0x0599, 4);                                    // 0598 ana a
        if (regs.fZ) { m.step(0x061b, 10); block = 0x061b; break; }
        m.step(0x059c, 10);
        regs.hl = mem.read16(0x2076); m.step(0x059f, 16);                       // 059c lhld 0x2076
        regs.c = mem.read8(regs.hl); m.step(0x05a0, 7);                         // 059f mov c,m
        regs.hl = (regs.hl + 1) & 0xffff; m.step(0x05a1, 5);                    // 05a0 inx h
        m.step(0x05a2, 4);
        mem.write16(0x2076, regs.hl); m.step(0x05a5, 16);                       // 05a2 shld 0x2076
        block = 0x05a5; break;
      }
      case 0x05a5: {
        m.push16(0x05a8); m.step(0x062f, 17); m.call(0x062f);                   // 05a5 call 0x062f
        if (regs.fNC) { return m.ret(11); }
        m.step(0x05a9, 5);
        m.push16(0x05ac); m.step(0x017a, 17); m.call(0x017a);                   // 05a9 call 0x017a
        regs.a = regs.c; m.step(0x05ad, 5);                                     // 05ac mov a,c
        regs.add(0x07); m.step(0x05af, 7);                                      // 05ad adi 0x07
        regs.h = regs.a; m.step(0x05b0, 5);                                     // 05af mov h,a
        regs.a = regs.l; m.step(0x05b1, 5);                                     // 05b0 mov a,l
        regs.sub(0x0a); m.step(0x05b3, 7);                                      // 05b1 sui 0x0a
        regs.l = regs.a; m.step(0x05b4, 5);                                     // 05b3 mov l,a
        mem.write16(0x207b, regs.hl); m.step(0x05b7, 16);                       // 05b4 shld 0x207b
        block = 0x05b7; break;
      }
      case 0x05b7: {
        regs.hl = 0x2073; m.step(0x05ba, 10);                                   // 05b7 lxi h,0x2073
        regs.a = mem.read8(regs.hl); m.step(0x05bb, 7);                         // 05ba mov a,m
        regs.or(0x80); m.step(0x05bd, 7);                                       // 05bb ori 0x80
        mem.write8(regs.hl, regs.a); m.step(0x05be, 7);                         // 05bd mov m,a
        regs.hl = (regs.hl + 1) & 0xffff; m.step(0x05bf, 5);                    // 05be inx h
        regs.incMem8(mem, regs.hl); m.step(0x05c0, 10);                         // 05bf inr m
        return m.ret(10);
      }
      case 0x05c1: {
        regs.de = 0x207c; m.step(0x05c4, 10);                                   // 05c1 lxi d,0x207c
        m.push16(0x05c7); m.step(0x1a06, 17); m.call(0x1a06);                   // 05c4 call 0x1a06
        if (regs.fNC) { return m.ret(11); }
        m.step(0x05c8, 5);
        regs.hl = (regs.hl + 1) & 0xffff; m.step(0x05c9, 5);                    // 05c8 inx h
        regs.a = mem.read8(regs.hl); m.step(0x05ca, 7);                         // 05c9 mov a,m
        regs.and(0x01); m.step(0x05cc, 7);                                      // 05ca ani 0x01
        if (regs.fNZ) { m.step(0x0644, 10); return m.call(0x0644); }
        m.step(0x05cf, 10);
        regs.hl = (regs.hl + 1) & 0xffff; m.step(0x05d0, 5);                    // 05cf inx h
        regs.incMem8(mem, regs.hl); m.step(0x05d1, 10);                         // 05d0 inr m
        m.push16(0x05d4); m.step(0x0675, 17); m.call(0x0675);                   // 05d1 call 0x0675
        regs.a = mem.read8(0x2079); m.step(0x05d7, 13);                         // 05d4 lda 0x2079
        regs.add(0x03); m.step(0x05d9, 7);                                      // 05d7 adi 0x03
        regs.hl = 0x207f; m.step(0x05dc, 10);                                   // 05d9 lxi h,0x207f
        regs.cp(mem.read8(regs.hl)); m.step(0x05dd, 7);                         // 05dc cmp m
        if (regs.fC) { m.step(0x05e2, 10); block = 0x05e2; break; }
        m.step(0x05e0, 10);
        regs.sub(0x0c); m.step(0x05e2, 7);                                      // 05e0 sui 0x0c
        block = 0x05e2; break;
      }
      case 0x05e2: {
        mem.write8(0x2079, regs.a); m.step(0x05e5, 13);                         // 05e2 sta 0x2079
        regs.a = mem.read8(0x207b); m.step(0x05e8, 13);                         // 05e5 lda 0x207b
        regs.b = regs.a; m.step(0x05e9, 5);                                     // 05e8 mov b,a
        regs.a = mem.read8(0x207e); m.step(0x05ec, 13);                         // 05e9 lda 0x207e
        regs.add(regs.b); m.step(0x05ed, 4);                                    // 05ec add b
        mem.write8(0x207b, regs.a); m.step(0x05f0, 13);                         // 05ed sta 0x207b
        m.push16(0x05f3); m.step(0x066c, 17); m.call(0x066c);                   // 05f0 call 0x066c
        regs.a = mem.read8(0x207b); m.step(0x05f6, 13);                         // 05f3 lda 0x207b
        regs.cp(0x15); m.step(0x05f8, 7);                                       // 05f6 cpi 0x15
        if (regs.fC) { m.step(0x0612, 10); block = 0x0612; break; }
        m.step(0x05fb, 10);
        regs.a = mem.read8(0x2061); m.step(0x05fe, 13);                         // 05fb lda 0x2061
        regs.and(regs.a); m.step(0x05ff, 4);                                    // 05fe ana a
        if (regs.fZ) { return m.ret(11); }
        m.step(0x0600, 5);
        regs.a = mem.read8(0x207b); m.step(0x0603, 13);                         // 0600 lda 0x207b
        regs.cp(0x1e); m.step(0x0605, 7);                                       // 0603 cpi 0x1e
        if (regs.fC) { m.step(0x0612, 10); block = 0x0612; break; }
        m.step(0x0608, 10);
        regs.cp(0x27); m.step(0x060a, 7);                                       // 0608 cpi 0x27
        m.step(0x060b, 4);
        if (regs.fNC) { m.step(0x0612, 10); block = 0x0612; break; }
        m.step(0x060e, 10);
        regs.sub(regs.a); m.step(0x060f, 4);                                    // 060e sub a
        mem.write8(0x2015, regs.a); m.step(0x0612, 13);                         // 060f sta 0x2015
        block = 0x0612; break;
      }
      case 0x0612: {
        regs.a = mem.read8(0x2073); m.step(0x0615, 13);                         // 0612 lda 0x2073
        regs.or(0x01); m.step(0x0617, 7);                                       // 0615 ori 0x01
        mem.write8(0x2073, regs.a); m.step(0x061a, 13);                         // 0617 sta 0x2073
        return m.ret(10);
      }
      case 0x061b: {
        regs.a = mem.read8(0x201b); m.step(0x061e, 13);                         // 061b lda 0x201b
        regs.add(0x08); m.step(0x0620, 7);                                      // 061e adi 0x08
        regs.h = regs.a; m.step(0x0621, 5);                                     // 0620 mov h,a
        m.push16(0x0624); m.step(0x156f, 17); m.call(0x156f);                   // 0621 call 0x156f
        regs.a = regs.c; m.step(0x0625, 5);                                     // 0624 mov a,c
        regs.cp(0x0c); m.step(0x0627, 7);                                       // 0625 cpi 0x0c
        if (regs.fC) { m.step(0x05a5, 10); block = 0x05a5; break; }
        m.step(0x062a, 10);
        regs.c = 0x0b; m.step(0x062c, 7);                                       // 062a mvi c,0x0b
        m.step(0x05a5, 10); block = 0x05a5; break;
      }
    }
  }
}
