// SPDX-License-Identifier: GPL-3.0-only
// loc_2741  (ROM 0x2741-0x2872) -- per-tick spider/flea spawn+move spine: gates on $c1/$c2/$ee/$ef, drives the
// $37d5/$3833/$3836 writers, advances $c0, and dispatches loc_2509/loc_252a/loc_2932/loc_2d5c/etc.
export function loc_2741(m) {
  const { regs, mem } = m;
  let label = 0x2741;
  for (;;) {
    switch (label) {
      case 0x2741: {
        regs.a = mem.read8(0x00c1); regs.setNZ(regs.a); m.step(0x2743, 3);
        regs.and(mem.read8(0x00c2)); m.step(0x2745, 3);
        if (regs.fPl) { m.step(0x2748, 3); label = 0x2748; continue; }     // 2745 bpl $2748
        m.step(0x2747, 2);                                                 // 2745 bpl (fall)
        return m.ret(6);                                                   // 2747 rts
      }
      case 0x2748: {
        regs.a = mem.read8(0x00c2); regs.setNZ(regs.a); m.step(0x274a, 3);
        if (regs.fN) { m.step(0x2764, 3); label = 0x2764; continue; }      // 274a bmi $2764
        m.step(0x274c, 2);                                                 // 274a bmi (fall)
        regs.a = mem.read8(0x00ee); regs.setNZ(regs.a); m.step(0x274e, 3);
        if (regs.fPl) { m.step(0x2764, 3); label = 0x2764; continue; }     // 274e bpl $2764
        m.step(0x2750, 2);                                                 // 274e bpl (fall)
        regs.a = mem.read8(0x00ef); regs.setNZ(regs.a); m.step(0x2752, 3);
        if (regs.fNZ) { m.step(0x2764, 3); label = 0x2764; continue; }     // 2752 bne $2764
        m.step(0x2754, 2);                                                 // 2752 bne (fall)
        regs.a = 0x82; regs.setNZ(regs.a); m.step(0x2756, 2);
        mem.write8(0x00ee, regs.a); m.step(0x2758, 3);
        m.push16(0x275a); m.step(0x275b, 6); m.call(0x252a);
        m.push16(0x275d); m.step(0x275e, 6); m.call(0x31d5);
        m.push16(0x2760); m.step(0x2761, 6); m.call(0x32fe);
        m.push16(0x2763); m.step(0x2764, 6); m.call(0x2932);
        label = 0x2764; continue;                                         // fall into 2764
      }
      case 0x2764: {
        regs.a = mem.read8(0x0089); regs.setNZ(regs.a); m.step(0x2766, 3);
        regs.a = regs.lsr(regs.a); m.step(0x2767, 2);
        if (regs.fZ) { m.step(0x277d, 3); label = 0x277d; continue; }      // 2767 beq $277d
        m.step(0x2769, 2);                                                 // 2767 beq (fall)
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x276b, 2);
        m.push16(0x276d); m.step(0x276e, 6); m.call(0x37d5);
        regs.y = 0x02; regs.setNZ(regs.y); m.step(0x2770, 2);
        regs.x = mem.read8(0x00c2); regs.setNZ(regs.x); m.step(0x2772, 3);
        if (regs.fPl) { m.step(0x2775, 3); label = 0x2775; continue; }     // 2772 bpl $2775
        m.step(0x2774, 2);                                                 // 2772 bpl (fall)
        regs.y = regs.dec8(regs.y); m.step(0x2775, 2);
        label = 0x2775; continue;                                         // fall into 2775
      }
      case 0x2775: {
        mem.write8(0x0088, regs.y); m.step(0x2777, 3);
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x2778, 2);
        regs.ora(0x20); m.step(0x277a, 2);
        m.push16(0x277c); m.step(0x277d, 6); m.call(0x3836);
        label = 0x277d; continue;                                         // fall into 277d
      }
      case 0x277d: {
        regs.a = 0x08; regs.setNZ(regs.a); m.step(0x277f, 2);
        m.push16(0x2781); m.step(0x2782, 6); m.call(0x37d5);
        regs.a = 0x05; regs.setNZ(regs.a); m.step(0x2784, 2);
        m.push16(0x2786); m.step(0x2787, 6); m.call(0x37d5);
        regs.a = 0x89; regs.setNZ(regs.a); m.step(0x2789, 2);
        regs.eor(mem.read8(0x00f5)); m.step(0x278b, 3);
        mem.write8(0x0091, regs.a); m.step(0x278d, 3);
        regs.a = 0x05; regs.setNZ(regs.a); m.step(0x278f, 2);
        regs.eor(mem.read8(0x00f7)); m.step(0x2791, 3);
        mem.write8(0x0092, regs.a); m.step(0x2793, 3);
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x2795, 3);
        regs.y = mem.read8((0x00c0 + regs.x) & 0xff); regs.setNZ(regs.y); m.step(0x2797, 4);
        mem.write8(0x008d, regs.y); m.step(0x2799, 3);
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x279a, 2);
        regs.clc(); m.step(0x279b, 2);
        regs.adc(mem.read8(0x00c0)); m.step(0x279d, 3);
        mem.write8(0x008e, regs.a); m.step(0x279f, 3);
        m.push16(0x27a1); m.step(0x27a2, 6); m.call(0x3833);
        regs.y = mem.read8(0x008d); regs.setNZ(regs.y); m.step(0x27a4, 3);
        regs.y = regs.inc8(regs.y); m.step(0x27a5, 2);
        m.push16(0x27a7); m.step(0x27a8, 6); m.call(0x3833);
        regs.y = mem.read8(0x008d); regs.setNZ(regs.y); m.step(0x27aa, 3);
        regs.y = regs.inc8(regs.y); m.step(0x27ab, 2);
        regs.y = regs.inc8(regs.y); m.step(0x27ac, 2);
        m.push16(0x27ae); m.step(0x27af, 6); m.call(0x3833);
        regs.a = mem.read8(0x0c01); regs.setNZ(regs.a); m.step(0x27b2, 4);
        regs.x = mem.read8(0x00ef); regs.setNZ(regs.x); m.step(0x27b4, 3);
        if (regs.fZ) { m.step(0x27b7, 3); label = 0x27b7; continue; }      // 27b4 beq $27b7
        m.step(0x27b6, 2);                                                 // 27b4 beq (fall)
        regs.a = regs.lsr(regs.a); m.step(0x27b7, 2);
        label = 0x27b7; continue;                                         // fall into 27b7
      }
      case 0x27b7: {
        regs.a = regs.lsr(regs.a); m.step(0x27b8, 2);
        regs.a = regs.lsr(regs.a); m.step(0x27b9, 2);
        regs.a = regs.lsr(regs.a); m.step(0x27ba, 2);
        mem.write8(0x009a, regs.rol(mem.read8(0x009a))); m.step(0x27bc, 5);
        regs.a = mem.read8(0x009a); regs.setNZ(regs.a); m.step(0x27be, 3);
        regs.and(0x1f); m.step(0x27c0, 2);
        regs.cmp(0x18); m.step(0x27c2, 2);
        if (regs.fNZ) { m.step(0x280a, 4); label = 0x280a; continue; }     // 27c2 bne $280a (page-cross)
        m.step(0x27c4, 2);                                                 // 27c2 bne (fall)
        mem.write8(0x00c0, regs.inc8(mem.read8(0x00c0))); m.step(0x27c6, 5);
        regs.a = mem.read8(0x00c0); regs.setNZ(regs.a); m.step(0x27c8, 3);
        regs.cmp(0x03); m.step(0x27ca, 2);
        if (regs.fNC) { m.step(0x27fe, 3); label = 0x27fe; continue; }     // 27ca bcc $27fe
        m.step(0x27cc, 2);                                                 // 27ca bcc (fall)
        label = 0x27cc; continue;                                         // fall into 27cc
      }
      case 0x27cc: {
        regs.x = mem.read8(0x0088); regs.setNZ(regs.x); m.step(0x27ce, 3);
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0x27d0, 2);
        mem.write8((0x00c0 + regs.x) & 0xff, regs.a); m.step(0x27d2, 4);
        regs.a = mem.read8(0x00ef); regs.setNZ(regs.a); m.step(0x27d4, 3);
        if (regs.fZ) { m.step(0x27f3, 3); label = 0x27f3; continue; }      // 27d4 beq $27f3
        m.step(0x27d6, 2);                                                 // 27d4 beq (fall)
        regs.a = 0x80; regs.setNZ(regs.a); m.step(0x27d8, 2);
        mem.write8(0x00ee, regs.a); m.step(0x27da, 3);
        m.push16(0x27dc); m.step(0x27dd, 6); m.call(0x2509);
        m.push16(0x27df); m.step(0x27e0, 6); m.call(0x31d5);
        m.push16(0x27e2); m.step(0x27e3, 6); m.call(0x2932);
        m.push16(0x27e5); m.step(0x27e6, 6); m.call(0x32fe);
        m.push16(0x27e8); m.step(0x27e9, 6); m.call(0x231f);
        m.push16(0x27eb); m.step(0x27ec, 6); m.call(0x21c7);
        m.push16(0x27ee); m.step(0x27ef, 6); m.call(0x20e8);
        regs.a = mem.read8(0x00c1); regs.setNZ(regs.a); m.step(0x27f1, 3);
        if (regs.fN) { m.step(0x2825, 4); label = 0x2825; continue; }      // 27f1 bmi $2825 (page-cross)
        m.step(0x27f3, 2);                                                 // 27f1 bmi (fall)
        label = 0x27f3; continue;                                         // fall into 27f3
      }
      case 0x27f3: {
        regs.a = mem.read8(0x00c1); regs.setNZ(regs.a); m.step(0x27f5, 3);
        regs.and(mem.read8(0x00c2)); m.step(0x27f7, 3);
        if (regs.fN) { m.step(0x2810, 4); label = 0x2810; continue; }      // 27f7 bmi $2810 (page-cross)
        m.step(0x27f9, 2);                                                 // 27f7 bmi (fall)
        label = 0x27f9; continue;                                         // fall into 27f9
      }
      case 0x27f9: {
        regs.x = 0x00; regs.setNZ(regs.x); m.step(0x27fb, 2);
        mem.write8(0x00c0, regs.x); m.step(0x27fd, 3);
        return m.ret(6);                                                   // 27fd rts
      }
      case 0x27fe: {
        mem.write8(0x008e, regs.inc8(mem.read8(0x008e))); m.step(0x2800, 5);
        regs.x = mem.read8(0x008e); regs.setNZ(regs.x); m.step(0x2802, 3);
        regs.a = 0xf4; regs.setNZ(regs.a); m.step(0x2804, 2);
        mem.write8(0x0001, regs.a); m.step(0x2806, 3);
        regs.a = 0x01; regs.setNZ(regs.a); m.step(0x2808, 2);
        mem.write8((0x001a + regs.x) & 0xff, regs.a); m.step(0x280a, 4);
        label = 0x280a; continue;                                         // fall into 280a
      }
      case 0x280a: {
        regs.a = mem.read8(0x0001); regs.setNZ(regs.a); m.step(0x280c, 3);
        if (regs.fZ) { m.step(0x27cc, 4); label = 0x27cc; continue; }      // 280c beq $27cc (page-cross)
        m.step(0x280e, 2);                                                 // 280c beq (fall)
        if (regs.fNZ) { m.step(0x283e, 3); label = 0x283e; continue; }     // 280e bne $283e
        m.step(0x2810, 2);                                                 // 280e bne (fall)
        label = 0x2810; continue;                                         // fall into 2810
      }
      case 0x2810: {
        regs.a = 0x88; regs.setNZ(regs.a); m.step(0x2812, 2);
        m.push16(0x2814); m.step(0x2815, 6); m.call(0x37d5);
        regs.a = 0x85; regs.setNZ(regs.a); m.step(0x2817, 2);
        m.push16(0x2819); m.step(0x281a, 6); m.call(0x37d5);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x281c, 2);
        mem.write8(0x0589, regs.a); m.step(0x281f, 4);
        mem.write8(0x05a9, regs.a); m.step(0x2822, 4);
        mem.write8(0x05c9, regs.a); m.step(0x2825, 4);
        label = 0x2825; continue;                                         // fall into 2825
      }
      case 0x2825: {
        m.push16(0x2827); m.step(0x2828, 6); m.call(0x26a0);
        m.push16(0x282a); m.step(0x282b, 6); m.call(0x2d5c);
        regs.x = mem.read8(0x0089); regs.setNZ(regs.x); m.step(0x282d, 3);
        mem.write8(0x0001, regs.x); m.step(0x282f, 3);
        regs.x = regs.dec8(regs.x); m.step(0x2830, 2);
        if (regs.fZ) { m.step(0x27f9, 4); label = 0x27f9; continue; }      // 2830 beq $27f9 (page-cross)
        m.step(0x2832, 2);                                                 // 2830 beq (fall)
        regs.a = 0x80; regs.setNZ(regs.a); m.step(0x2834, 2);
        m.push16(0x2836); m.step(0x2837, 6); m.call(0x37d5);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2839, 2);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x283a, 2);
        mem.write8((mem.read16(0x0091) + regs.y) & 0xffff, regs.a); m.step(0x283c, 6);
        if (regs.fZ) { m.step(0x27f9, 4); label = 0x27f9; continue; }      // 283c beq $27f9 (page-cross)
        m.step(0x283e, 2);                                                 // 283c beq (fall)
        label = 0x283e; continue;                                         // fall into 283e
      }
      case 0x283e: {
        regs.a = mem.read8(0x0000); regs.setNZ(regs.a); m.step(0x2840, 3);
        regs.and(0x07); m.step(0x2842, 2);
        if (regs.fNZ) { m.step(0x286f, 3); label = 0x286f; continue; }     // 2842 bne $286f
        m.step(0x2844, 2);                                                 // 2842 bne (fall)
        regs.x = 0xff; regs.setNZ(regs.x); m.step(0x2846, 2);
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2848, 2);
        regs.y = mem.read8(0x00b9); regs.setNZ(regs.y); m.step(0x284a, 3);
        mem.write8(0x00b9, regs.a); m.step(0x284c, 3);
        if (regs.fPl) { m.step(0x2855, 3); label = 0x2855; continue; }     // 284c bpl $2855
        m.step(0x284e, 2);                                                 // 284c bpl (fall)
        regs.x = 0x01; regs.setNZ(regs.x); m.step(0x2850, 2);
        regs.a = regs.y; regs.setNZ(regs.a); m.step(0x2851, 2);
        m.push16(0x2853); m.step(0x2854, 6); m.call(0x382d);
        regs.y = regs.a; regs.setNZ(regs.y); m.step(0x2855, 2);
        label = 0x2855; continue;                                         // fall into 2855
      }
      case 0x2855: {
        regs.cpy(0x04); m.step(0x2857, 2);
        if (regs.fNC) { m.step(0x286f, 3); label = 0x286f; continue; }     // 2857 bcc $286f
        m.step(0x2859, 2);                                                 // 2857 bcc (fall)
        regs.a = regs.x; regs.setNZ(regs.a); m.step(0x285a, 2);
        regs.eor(mem.read8(0x00f4)); m.step(0x285c, 3);
        regs.x = mem.read8(0x008e); regs.setNZ(regs.x); m.step(0x285e, 3);
        regs.clc(); m.step(0x285f, 2);
        regs.adc(mem.read8((0x001a + regs.x) & 0xff)); m.step(0x2861, 4);
        if (regs.fN) { m.step(0x286b, 3); label = 0x286b; continue; }      // 2861 bmi $286b
        m.step(0x2863, 2);                                                 // 2861 bmi (fall)
        regs.cmp(0x1b); m.step(0x2865, 2);
        if (regs.fNC) { m.step(0x286d, 3); label = 0x286d; continue; }     // 2865 bcc $286d
        m.step(0x2867, 2);                                                 // 2865 bcc (fall)
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2869, 2);
        if (regs.fZ) { m.step(0x286d, 3); label = 0x286d; continue; }      // 2869 beq $286d
        m.step(0x286b, 2);                                                 // 2869 beq (fall)
        label = 0x286b; continue;                                         // fall into 286b
      }
      case 0x286b: {
        regs.a = 0x1a; regs.setNZ(regs.a); m.step(0x286d, 2);
        label = 0x286d; continue;                                         // fall into 286d
      }
      case 0x286d: {
        mem.write8((0x001a + regs.x) & 0xff, regs.a); m.step(0x286f, 4);
        label = 0x286f; continue;                                         // fall into 286f
      }
      case 0x286f: {
        regs.a = 0x00; regs.setNZ(regs.a); m.step(0x2871, 2);
        return m.ret(6);                                                   // 2871 rts
      }
    }
  }
}
