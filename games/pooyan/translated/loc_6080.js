// SPDX-License-Identifier: GPL-3.0-only

// loc_6080  (ROM 0x6080-0x60bb) -- entry (jp/jp-z target 0x61d4/0x61e6 + table word 0x2d01).
// Signed X delta = IX[0] + (0x881f ? 6 : -2); |A| must be < 9 or tail-jump loc_60f2 (miss).
// Signed Y delta = (IX[2]+8) - (IY[0]); |A| must be < 8 or tail-jump loc_60f2. On a hit,
// advance HL by 0x14, point IY at 0x8ae0, load (HL)/C=6/E=0x18 and fall through into loc_60bc.
export function loc_6080(m) {
  const { regs, mem } = m;

  regs.e = 0x06;                                   m.step(0x6082, 7);
  regs.a = mem.read8(0x881f);                      m.step(0x6085, 13);
  regs.and(regs.a);                                m.step(0x6086, 4);
  if (regs.fNZ) {
    m.step(0x608a, 12);                            // jr nz taken
  } else {
    m.step(0x6088, 7);                             // jr nz not taken
    regs.e = 0xfe;                                 m.step(0x608a, 7);
  }
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);   m.step(0x608d, 19);
  regs.add(regs.e);                                m.step(0x608e, 4);
  regs.e = regs.a;                                 m.step(0x608f, 4);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);   m.step(0x6092, 19);
  regs.add(0x08);                                  m.step(0x6094, 7);
  regs.d = regs.a;                                 m.step(0x6095, 4);
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff);   m.step(0x6098, 19);
  regs.sub(regs.e);                                m.step(0x6099, 4);
  if (regs.fNC) {
    m.step(0x609d, 12);                            // jr nc taken (delta >= 0)
  } else {
    m.step(0x609b, 7);                             // jr nc not taken
    regs.neg();                                    m.step(0x609d, 8); // |delta|
  }
  regs.cp(0x09);                                   m.step(0x609f, 7);
  if (regs.fNC) { m.step(0x60f2, 12); return m.call(0x60f2); } // jr nc tail -- X gap >= 9
  m.step(0x60a1, 7);                               // jr nc not taken
  regs.a = mem.read8((regs.iy + 0x02) & 0xffff);   m.step(0x60a4, 19);
  regs.add(0x08);                                  m.step(0x60a6, 7);
  regs.sub(regs.d);                                m.step(0x60a7, 4);
  if (regs.fNC) {
    m.step(0x60ab, 12);                            // jr nc taken (delta >= 0)
  } else {
    m.step(0x60a9, 7);                             // jr nc not taken
    regs.neg();                                    m.step(0x60ab, 8); // |delta|
  }
  regs.cp(0x08);                                   m.step(0x60ad, 7);
  if (regs.fNC) { m.step(0x60f2, 12); return m.call(0x60f2); } // jr nc tail -- Y gap >= 8
  m.step(0x60af, 7);                               // jr nc not taken
  regs.de = 0x0014;                                m.step(0x60b2, 10);
  regs.addHl(regs.de);                             m.step(0x60b3, 11);
  regs.iy = 0x8ae0;                                m.step(0x60b7, 14);
  regs.a = mem.read8(regs.hl);                     m.step(0x60b8, 7);
  regs.c = 0x06;                                   m.step(0x60ba, 7);
  regs.e = 0x18;                                   m.step(0x60bc, 7);
  return m.call(0x60bc); // fall through into loc_60bc
}
