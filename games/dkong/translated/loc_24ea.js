// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_24ea  (ROM 0x24EA–0x2520).
 */
export function loc_24ea(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.a = 0x02; // the rst 0x30 rotate input
  m.step(0x24ec, 7); // ld a,0x02
  m.push16(0x24ed);
  m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // caller-skip: (0x6227)-bit test -> abort

  m.push16(0x24f0);
  m.step(0x2523, 17); // call 0x2523
  m.call(0x2523);
  m.push16(0x24f3);
  m.step(0x2591, 17); // call 0x2591 -- leaves DE=0x10
  m.call(0x2591);

  regs.ix = 0x65a0;
  m.step(0x24f7, 14); // ld ix,0x65a0
  regs.b = 0x06;
  m.step(0x24f9, 7); // ld b,0x06
  regs.hl = 0x69b8;
  m.step(0x24fc, 10); // ld hl,0x69b8

  do {
    regs.a = mem.read8(R(0x00));
    m.step(0x24ff, 19); // ld a,(ix+0x00)
    regs.and(regs.a);
    m.step(0x2500, 4); // and a
    if (regs.fZ) {
      // -- loc_251c: inactive slot -- skip its 4 buffer bytes --
      m.step(0x251c, 10); // jp z,0x251c
      regs.a = regs.l;
      m.step(0x251d, 4); // ld a,l
      regs.add(0x04);
      m.step(0x251f, 7); // add a,0x04
      regs.l = regs.a;
      m.step(0x2520, 4); // ld l,a
      m.step(0x2517, 10); // jp 0x2517 -- to the shared advance
    } else {
      m.step(0x2503, 10); // jp z not taken
      regs.a = mem.read8(R(0x03));
      m.step(0x2506, 19); // ld a,(ix+0x03)
      mem.write8(regs.hl, regs.a);
      m.step(0x2507, 7); // ld (hl),a
      regs.l = regs.inc8(regs.l);
      m.step(0x2508, 4); // inc l
      regs.a = mem.read8(R(0x07));
      m.step(0x250b, 19); // ld a,(ix+0x07)
      mem.write8(regs.hl, regs.a);
      m.step(0x250c, 7); // ld (hl),a
      regs.l = regs.inc8(regs.l);
      m.step(0x250d, 4); // inc l
      regs.a = mem.read8(R(0x08));
      m.step(0x2510, 19); // ld a,(ix+0x08)
      mem.write8(regs.hl, regs.a);
      m.step(0x2511, 7); // ld (hl),a
      regs.l = regs.inc8(regs.l);
      m.step(0x2512, 4); // inc l
      regs.a = mem.read8(R(0x05));
      m.step(0x2515, 19); // ld a,(ix+0x05)
      mem.write8(regs.hl, regs.a);
      m.step(0x2516, 7); // ld (hl),a
      regs.l = regs.inc8(regs.l);
      m.step(0x2517, 4); // inc l
    }
    regs.addIx(regs.de); // add ix,de -- DE = 0x10 (from sub_2591)
    m.step(0x2519, 15);
    regs.b = (regs.b - 1) & 0xff; // djnz
    m.step(regs.b !== 0 ? 0x24fc : 0x251b, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(10); // ret (0x251B)
}
