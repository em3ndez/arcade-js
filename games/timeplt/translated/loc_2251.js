// SPDX-License-Identifier: GPL-3.0-only

// loc_2251  (ROM 0x2251-0x22B8, Time Pilot)
export function loc_2251(m) {
  const { regs, mem } = m;

  regs.a = regs.inc8(regs.a);
  m.step(0x2252, 4); // 2251  inc a
  regs.a = regs.inc8(regs.a);
  m.step(0x2253, 4); // 2252  inc a
  regs.a = regs.inc8(regs.a);
  m.step(0x2254, 4); // 2253  inc a
  regs.a = regs.inc8(regs.a);
  m.step(0x2255, 4); // 2254  inc a

  regs.a = mem.read8(regs.bc);
  m.step(0x2256, 7); // 2255  ld a,(bc)
  regs.sub(regs.l);
  m.step(0x2257, 4); // 2256  sub l
  regs.h = regs.b;
  m.step(0x2258, 4); // 2257  ld h,b
  regs.b = regs.inc8(regs.b);
  m.step(0x2259, 4); // 2258  inc b
  regs.sbc(mem.read8(regs.hl));
  m.step(0x225a, 7); // 2259  sbc a,(hl)
  regs.d = regs.e;
  m.step(0x225b, 4); // 225a  ld d,e
  regs.c = regs.dec8(regs.c);
  m.step(0x225c, 4); // 225b  dec c
  regs.adc(regs.e);
  m.step(0x225d, 4); // 225c  adc a,e
  mem.write8(regs.bc, regs.a);
  m.step(0x225e, 7); // 225d  ld (bc),a
  regs.c = regs.e;
  m.step(0x225f, 4); // 225e  ld c,e
  regs.rrca();
  m.step(0x2260, 4); // 225f  rrca
  regs.sub(regs.e);
  m.step(0x2261, 4); // 2260  sub e
  regs.d = regs.e;
  m.step(0x2262, 4); // 2261  ld d,e
  regs.rlca();
  m.step(0x2263, 4); // 2262  rlca
  regs.xor(regs.c);
  m.step(0x2264, 4); // 2263  xor c
  regs.d = regs.h;
  m.step(0x2265, 4); // 2264  ld d,h
  regs.a = mem.read8(regs.bc);
  m.step(0x2266, 7); // 2265  ld a,(bc)
  regs.sub(mem.read8(regs.hl));
  m.step(0x2267, 7); // 2266  sub (hl)
  regs.bc = (regs.bc + 1) & 0xffff; // inc rr sets no flags
  m.step(0x2268, 6); // 2267  inc bc
  regs.h = regs.b;
  m.step(0x2269, 4); // 2268  ld h,b
  regs.rrca();
  m.step(0x226a, 4); // 2269  rrca
  regs.adc(regs.d);
  m.step(0x226b, 4); // 226a  adc a,d
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x226c, 6); // 226b  inc hl
  regs.c = regs.b;
  m.step(0x226d, 4); // 226c  ld c,b
  regs.cp(regs.c);
  m.step(0x226e, 4); // 226d  cp c
  mem.write8(regs.bc, regs.a);
  m.step(0x226f, 7); // 226e  ld (bc),a
  regs.add(regs.d);
  m.step(0x2270, 4); // 226f  add a,d
  regs.e = regs.c;
  m.step(0x2271, 4); // 2270  ld e,c
  regs.sbc(regs.a);
  m.step(0x2272, 4); // 2271  sbc a,a
  regs.e = regs.c;
  m.step(0x2273, 4); // 2272  ld e,c

  regs.bc = 0x228b;
  m.step(0x2276, 10); // 2273  ld bc,0x228b
  regs.xor(regs.e);
  m.step(0x2277, 4); // 2276  xor e
  mem.write8(regs.bc, regs.a);
  m.step(0x2278, 7); // 2277  ld (bc),a -- BC = 0x228B, ROM, inert
  regs.c = regs.e;
  m.step(0x2279, 4); // 2278  ld c,e
  mem.write8(regs.bc, regs.a);
  m.step(0x227a, 7); // 2279  ld (bc),a
  regs.adc(regs.e);
  m.step(0x227b, 4); // 227a  adc a,e
  regs.rlca();
  m.step(0x227c, 4); // 227b  rlca
  regs.d = regs.l;
  m.step(0x227d, 4); // 227c  ld d,l
  regs.xor(regs.h);
  m.step(0x227e, 4); // 227d  xor h
  regs.b = regs.d;
  m.step(0x227f, 4); // 227e  ld b,d

  regs.bc = 0x9050;
  m.step(0x2282, 10); // 227f  ld bc,0x9050
  mem.write8(regs.bc, regs.a);
  m.step(0x2283, 7); // 2282  ld (bc),a -- BC = 0x9050, unmapped, inert
  regs.d = regs.l;
  m.step(0x2284, 4); // 2283  ld d,l
  regs.decMem8(mem, regs.hl);
  m.step(0x2285, 11); // 2284  dec (hl)
  regs.sub(regs.b);
  m.step(0x2286, 4); // 2285  sub b
  regs.d = regs.b;
  m.step(0x2287, 4); // 2286  ld d,b
  regs.b = regs.inc8(regs.b);
  m.step(0x2288, 4); // 2287  inc b
  regs.sub(regs.d);
  m.step(0x2289, 4); // 2288  sub d
  m.step(0x228a, 4); // 2289  ld e,e
  regs.adc(regs.c);
  m.step(0x228b, 4); // 228a  adc a,c
  regs.rra();
  m.step(0x228c, 4); // 228b  rra
  regs.c = regs.b;
  m.step(0x228d, 4); // 228c  ld c,b
  regs.adc(regs.b);
  m.step(0x228e, 4); // 228d  adc a,b
  regs.b = regs.dec8(regs.b);
  m.step(0x228f, 4); // 228e  dec b
  regs.adc(regs.h);
  m.step(0x2290, 4); // 228f  adc a,h
  regs.b = regs.d;
  m.step(0x2291, 4); // 2290  ld b,d
  regs.b = regs.dec8(regs.b);
  m.step(0x2292, 4); // 2291  dec b
  regs.c = regs.d;
  m.step(0x2293, 4); // 2292  ld c,d
  regs.a = regs.inc8(regs.a);
  m.step(0x2294, 4); // 2293  inc a
  regs.c = regs.inc8(regs.c);
  m.step(0x2295, 4); // 2294  inc c
  regs.b = mem.read8(regs.hl);
  m.step(0x2296, 7); // 2295  ld b,(hl)
  regs.add(mem.read8(regs.hl));
  m.step(0x2297, 7); // 2296  add a,(hl)
  regs.a = regs.inc8(regs.a);
  m.step(0x2298, 4); // 2297  inc a
  regs.b = regs.inc8(regs.b);
  m.step(0x2299, 4); // 2298  inc b
  regs.sub(regs.e);
  m.step(0x229a, 4); // 2299  sub e
  regs.e = mem.read8(regs.hl);
  m.step(0x229b, 7); // 229a  ld e,(hl)
  regs.b = 0x4b;
  m.step(0x229d, 7); // 229b  ld b,0x4b
  regs.addHl(regs.bc);
  m.step(0x229e, 11); // 229d  add hl,bc
  regs.c = regs.d;
  m.step(0x229f, 4); // 229e  ld c,d
  regs.a = mem.read8(regs.bc);
  m.step(0x22a0, 7); // 229f  ld a,(bc)
  regs.a = regs.h;
  m.step(0x22a1, 4); // 22a0  ld a,h
  regs.a = regs.h;
  m.step(0x22a2, 4); // 22a1  ld a,h
  regs.l = regs.a;
  m.step(0x22a3, 4); // 22a2  ld l,a
  regs.cp(regs.h);
  m.step(0x22a4, 4); // 22a3  cp h

  regs.bc = 0x078b;
  m.step(0x22a7, 10); // 22a4  ld bc,0x078b
  regs.sub(regs.d);
  m.step(0x22a8, 4); // 22a7  sub d
  regs.c = regs.b;
  m.step(0x22a9, 4); // 22a8  ld c,b
  regs.rlca();
  m.step(0x22aa, 4); // 22a9  rlca
  regs.adc(regs.b);
  m.step(0x22ab, 4); // 22aa  adc a,b
  regs.a = regs.h;
  m.step(0x22ac, 4); // 22ab  ld a,h
  regs.a = regs.h;
  m.step(0x22ad, 4); // 22ac  ld a,h
  regs.b = regs.l;
  m.step(0x22ae, 4); // 22ad  ld b,l

  regs.de = 0x5090;
  m.step(0x22b1, 10); // 22ae  ld de,0x5090
  regs.bc = 0x078b;
  m.step(0x22b4, 10); // 22b1  ld bc,0x078b
  regs.c = regs.e;
  m.step(0x22b5, 4); // 22b4  ld c,e
  regs.c = regs.inc8(regs.c);
  m.step(0x22b6, 4); // 22b5  inc c
  regs.adc(regs.e);
  m.step(0x22b7, 4); // 22b6  adc a,e
  regs.a = mem.read8(regs.bc);
  m.step(0x22b8, 7); // 22b7  ld a,(bc)

  for (;;) m.step(0x22b8, 4); // 22b8  halt
}
