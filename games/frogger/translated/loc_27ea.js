// SPDX-License-Identifier: GPL-3.0-only

// loc_27ea  (ROM 0x27EA-0x2855) — diver/turtle-dive animation driver; three entry points share the
// range. loc_27ea (0x27EA) dispatches on the dive phase (0x83B7). loc_27fe (0x27FE, also entered by
// loc_2874's jp) walks the surface-timer pair (0x8146)/(0x8147). loc_281b (0x281B, also entered by
// loc_286d's jp) copies a 2-byte anim frame from ROM table (HL) to VRAM (DE = 0xA806 + (0x8145)).
export function loc_27ea(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83b7);
  m.step(0x27ed, 13);
  regs.cp(0x02);
  m.step(0x27ef, 7);
  if (regs.fC) {
    m.step(0x2873, 10); // jp c,0x2873 -- phase < 2
    return m.call(0x2873);
  }
  m.step(0x27f2, 10);
  regs.cp(0x05);
  m.step(0x27f4, 7);
  if (regs.fNC) {
    m.step(0x2874, 10); // jp nc,0x2874 -- phase >= 5
    return m.call(0x2874);
  }
  m.step(0x27f7, 10);
  regs.a = mem.read8(0x8101);
  m.step(0x27fa, 13);
  regs.and(regs.a);
  m.step(0x27fb, 4);
  if (regs.fZ) {
    m.push16(0x27fe);
    m.step(0x288c, 17); // call z,0x288c -- (0x8101)==0
    m.call(0x288c);
  } else {
    m.step(0x27fe, 10);
  }
  return m.call(0x27fe); // fall through into loc_27fe
}

export function loc_27fe(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x814f);
  m.step(0x2801, 13);
  regs.and(regs.a);
  m.step(0x2802, 4);
  if (regs.fZ) {
    m.ret(11); // ret z -- (0x814f)==0, dive idle
    return;
  }
  m.step(0x2803, 5);
  regs.hl = 0x8146;
  m.step(0x2806, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x2807, 7); // A = (0x8146)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2808, 6);
  regs.cp(mem.read8(regs.hl));
  m.step(0x2809, 7); // cp (0x8147)
  if (regs.fNZ) {
    m.step(0x28b0, 10); // jp nz,0x28b0 -- (0x8146) != (0x8147)
    return m.call(0x28b0);
  }
  m.step(0x280c, 10);
  regs.decMem8(mem, regs.hl);
  m.step(0x280d, 11); // dec (0x8147)
  regs.de = 0xa806;
  m.step(0x2810, 10);
  regs.a = mem.read8(0x8150);
  m.step(0x2813, 13);
  regs.bit(0, regs.a);
  m.step(0x2815, 8);
  if (regs.fZ) {
    m.step(0x286d, 10); // jp z,0x286d -- (0x8150) bit0 == 0
    return m.call(0x286d);
  }
  m.step(0x2818, 10);
  regs.hl = 0x1413;
  m.step(0x281b, 10); // fall through into loc_281b
  return m.call(0x281b);
}

export function loc_281b(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x281c, 4);
  regs.b = regs.a;
  m.step(0x281d, 4);
  regs.a = mem.read8(0x814e);
  m.step(0x2820, 13);
  regs.c = regs.a;
  m.step(0x2821, 4); // BC = (0x814e) -- frame index
  regs.a = regs.inc8(regs.a);
  m.step(0x2822, 4);
  regs.a = regs.inc8(regs.a);
  m.step(0x2823, 4);
  mem.write8(0x814e, regs.a);
  m.step(0x2826, 13); // (0x814e) += 2
  regs.addHl(regs.bc);
  m.step(0x2827, 11); // HL = table + frame index
  regs.b = 0x00;
  m.step(0x2829, 7);
  regs.exDeHl();
  m.step(0x282a, 4); // DE = table ptr, HL = 0xa806
  regs.a = mem.read8(0x8145);
  m.step(0x282d, 13);
  regs.c = regs.a;
  m.step(0x282e, 4); // BC = (0x8145) -- VRAM column offset
  regs.addHl(regs.bc);
  m.step(0x282f, 11); // HL = 0xa806 + (0x8145)
  regs.exDeHl();
  m.step(0x2830, 4); // DE = VRAM dest, HL = table src
  regs.c = 0x20;
  m.step(0x2832, 7);
  regs.a = mem.read8(0x8145);
  m.step(0x2835, 13);
  regs.add(regs.c);
  m.step(0x2836, 4); // A = (0x8145) + 0x20
  mem.write8(0x8145, regs.a);
  m.step(0x2839, 13); // (0x8145) += 0x20
  regs.a = mem.read8(regs.hl);
  m.step(0x283a, 7);
  mem.write8(regs.de, regs.a);
  m.step(0x283b, 7); // (DE) = table[0]
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x283c, 6);
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x283d, 6);
  regs.a = mem.read8(regs.hl);
  m.step(0x283e, 7);
  mem.write8(regs.de, regs.a);
  m.step(0x283f, 7); // (DE+1) = table[1]
  regs.a = mem.read8(0x814e);
  m.step(0x2842, 13);
  regs.cp(0x10);
  m.step(0x2844, 7);
  if (regs.fC) {
    m.ret(11); // ret c -- frame index < 0x10
    return;
  }
  m.step(0x2845, 5);
  regs.xor(regs.a);
  m.step(0x2846, 4);
  mem.write8(0x814f, regs.a);
  m.step(0x2849, 13); // (0x814f) = 0
  mem.write8(0x814e, regs.a);
  m.step(0x284c, 13); // (0x814e) = 0
  mem.write8(0x8145, regs.a);
  m.step(0x284f, 13); // (0x8145) = 0
  mem.write8(0x8146, regs.a);
  m.step(0x2852, 13); // (0x8146) = 0
  mem.write8(0x8147, regs.a);
  m.step(0x2855, 13); // (0x8147) = 0
  m.ret(10);
}
