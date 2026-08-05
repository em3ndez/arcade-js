// SPDX-License-Identifier: GPL-3.0-only

import { F_C, F_F3, F_PV, F_S, F_Z } from "../../../core/cpu/z80.js";

function ldi(m) {
  const { regs, mem } = m;
  const v = mem.read8(regs.hl);
  mem.write8(regs.de, v);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.de = (regs.de + 1) & 0xffff;
  regs.bc = (regs.bc - 1) & 0xffff;
  const n = (regs.a + v) & 0xff;
  regs.f =
    (regs.f & (F_S | F_Z | F_C)) |
    (regs.bc !== 0 ? F_PV : 0) |
    (n & F_F3) |
    ((n & 0x02) << 4);
}

// loc_0365  (ROM 0x0365-0x074A)
export function loc_0365(m) {
  const { regs, mem } = m;

  regs.hl = 0xaa30; m.step(0x0368, 10); // ld hl,0xaa30
  regs.de = 0xb010; m.step(0x036b, 10); // ld de,0xb010
  regs.a = mem.read8(0xa987); m.step(0x036e, 13); // ld a,(0xa987)
  regs.and(regs.a); m.step(0x036f, 4); // and a
  if (regs.fZ) {
    m.step(0x0556, 10); // jp z,0x0556 (taken) -- the other variant
    return loc_0365_0556(m);
  }
  m.step(0x0372, 10); // jp z,0x0556 (not taken)

  ldi(m); m.step(0x0374, 16); // ldi
  ldi(m); m.step(0x0376, 16); // ldi
  ldi(m); m.step(0x0378, 16); // ldi
  ldi(m); m.step(0x037a, 16); // ldi
  ldi(m); m.step(0x037c, 16); // ldi
  ldi(m); m.step(0x037e, 16); // ldi
  regs.hl = 0xaa10; m.step(0x0381, 10); // ld hl,0xaa10
  ldi(m); m.step(0x0383, 16); // ldi
  ldi(m); m.step(0x0385, 16); // ldi
  ldi(m); m.step(0x0387, 16); // ldi
  ldi(m); m.step(0x0389, 16); // ldi
  ldi(m); m.step(0x038b, 16); // ldi
  ldi(m); m.step(0x038d, 16); // ldi
  ldi(m); m.step(0x038f, 16); // ldi
  ldi(m); m.step(0x0391, 16); // ldi
  ldi(m); m.step(0x0393, 16); // ldi
  ldi(m); m.step(0x0395, 16); // ldi
  ldi(m); m.step(0x0397, 16); // ldi
  ldi(m); m.step(0x0399, 16); // ldi
  ldi(m); m.step(0x039b, 16); // ldi
  ldi(m); m.step(0x039d, 16); // ldi
  ldi(m); m.step(0x039f, 16); // ldi
  ldi(m); m.step(0x03a1, 16); // ldi
  ldi(m); m.step(0x03a3, 16); // ldi
  ldi(m); m.step(0x03a5, 16); // ldi
  ldi(m); m.step(0x03a7, 16); // ldi
  ldi(m); m.step(0x03a9, 16); // ldi
  ldi(m); m.step(0x03ab, 16); // ldi
  ldi(m); m.step(0x03ad, 16); // ldi
  ldi(m); m.step(0x03af, 16); // ldi
  ldi(m); m.step(0x03b1, 16); // ldi
  ldi(m); m.step(0x03b3, 16); // ldi
  ldi(m); m.step(0x03b5, 16); // ldi
  ldi(m); m.step(0x03b7, 16); // ldi
  ldi(m); m.step(0x03b9, 16); // ldi
  ldi(m); m.step(0x03bb, 16); // ldi
  ldi(m); m.step(0x03bd, 16); // ldi
  ldi(m); m.step(0x03bf, 16); // ldi
  ldi(m); m.step(0x03c1, 16); // ldi
  regs.hl = 0xaa36; m.step(0x03c4, 10); // ld hl,0xaa36
  ldi(m); m.step(0x03c6, 16); // ldi
  ldi(m); m.step(0x03c8, 16); // ldi
  ldi(m); m.step(0x03ca, 16); // ldi
  ldi(m); m.step(0x03cc, 16); // ldi
  ldi(m); m.step(0x03ce, 16); // ldi
  ldi(m); m.step(0x03d0, 16); // ldi
  ldi(m); m.step(0x03d2, 16); // ldi
  ldi(m); m.step(0x03d4, 16); // ldi
  ldi(m); m.step(0x03d6, 16); // ldi
  ldi(m); m.step(0x03d8, 16); // ldi
  regs.hl = 0xaa60; m.step(0x03db, 10); // ld hl,0xaa60
  regs.de = 0xb410; m.step(0x03de, 10); // ld de,0xb410
  ldi(m); m.step(0x03e0, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x03e1, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x03e3, 7); // add a,0x0e
  regs.cpl(); m.step(0x03e4, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x03e5, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x03e6, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x03e7, 4); // inc e
  ldi(m); m.step(0x03e9, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x03ea, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x03ec, 7); // add a,0x0e
  regs.cpl(); m.step(0x03ed, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x03ee, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x03ef, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x03f0, 4); // inc e
  ldi(m); m.step(0x03f2, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x03f3, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x03f5, 7); // add a,0x0e
  regs.cpl(); m.step(0x03f6, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x03f7, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x03f8, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x03f9, 4); // inc e
  regs.hl = 0xaa40; m.step(0x03fc, 10); // ld hl,0xaa40
  ldi(m); m.step(0x03fe, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x03ff, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x0401, 7); // add a,0x0e
  regs.cpl(); m.step(0x0402, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0403, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0404, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0405, 4); // inc e
  ldi(m); m.step(0x0407, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0408, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x040a, 7); // add a,0x0e
  regs.cpl(); m.step(0x040b, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x040c, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x040d, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x040e, 4); // inc e
  ldi(m); m.step(0x0410, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0411, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x0413, 7); // add a,0x0e
  regs.cpl(); m.step(0x0414, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0415, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0416, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0417, 4); // inc e
  ldi(m); m.step(0x0419, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x041a, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x041c, 7); // add a,0x0e
  regs.cpl(); m.step(0x041d, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x041e, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x041f, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0420, 4); // inc e
  ldi(m); m.step(0x0422, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0423, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x0425, 7); // add a,0x0e
  regs.cpl(); m.step(0x0426, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0427, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0428, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0429, 4); // inc e
  ldi(m); m.step(0x042b, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x042c, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x042e, 7); // add a,0x0e
  regs.cpl(); m.step(0x042f, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0430, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0431, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0432, 4); // inc e
  ldi(m); m.step(0x0434, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0435, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x0437, 7); // add a,0x0e
  regs.cpl(); m.step(0x0438, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0439, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x043a, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x043b, 4); // inc e
  ldi(m); m.step(0x043d, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x043e, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x0440, 7); // add a,0x0e
  regs.cpl(); m.step(0x0441, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0442, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0443, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0444, 4); // inc e
  ldi(m); m.step(0x0446, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0447, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x0449, 7); // add a,0x0e
  regs.cpl(); m.step(0x044a, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x044b, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x044c, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x044d, 4); // inc e
  ldi(m); m.step(0x044f, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0450, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x0452, 7); // add a,0x0e
  regs.cpl(); m.step(0x0453, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0454, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0455, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0456, 4); // inc e
  ldi(m); m.step(0x0458, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0459, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x045b, 7); // add a,0x0e
  regs.cpl(); m.step(0x045c, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x045d, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x045e, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x045f, 4); // inc e
  ldi(m); m.step(0x0461, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0462, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x0464, 7); // add a,0x0e
  regs.cpl(); m.step(0x0465, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0466, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0467, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0468, 4); // inc e
  ldi(m); m.step(0x046a, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x046b, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x046d, 7); // add a,0x0e
  regs.cpl(); m.step(0x046e, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x046f, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0470, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0471, 4); // inc e
  ldi(m); m.step(0x0473, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0474, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x0476, 7); // add a,0x0e
  regs.cpl(); m.step(0x0477, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0478, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0479, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x047a, 4); // inc e
  ldi(m); m.step(0x047c, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x047d, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x047f, 7); // add a,0x0e
  regs.cpl(); m.step(0x0480, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0481, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0482, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0483, 4); // inc e
  ldi(m); m.step(0x0485, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0486, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x0488, 7); // add a,0x0e
  regs.cpl(); m.step(0x0489, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x048a, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x048b, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x048c, 4); // inc e
  regs.hl = 0xaa66; m.step(0x048f, 10); // ld hl,0xaa66
  ldi(m); m.step(0x0491, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0492, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x0494, 7); // add a,0x0e
  regs.cpl(); m.step(0x0495, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0496, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0497, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0498, 4); // inc e
  ldi(m); m.step(0x049a, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x049b, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x049d, 7); // add a,0x0e
  regs.cpl(); m.step(0x049e, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x049f, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x04a0, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x04a1, 4); // inc e
  ldi(m); m.step(0x04a3, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x04a4, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x04a6, 7); // add a,0x0e
  regs.cpl(); m.step(0x04a7, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x04a8, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x04a9, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x04aa, 4); // inc e
  ldi(m); m.step(0x04ac, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x04ad, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x04af, 7); // add a,0x0e
  regs.cpl(); m.step(0x04b0, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x04b1, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x04b2, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x04b3, 4); // inc e
  ldi(m); m.step(0x04b5, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x04b6, 7); // ld a,(hl)
  regs.add(0x0e); m.step(0x04b8, 7); // add a,0x0e
  regs.cpl(); m.step(0x04b9, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x04ba, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x04bb, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x04bc, 4); // inc e

  return loc_0365_04bc(m); // 0x04BB falls straight through into 0x04BC
}

export function loc_0365_04bc(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9ab); m.step(0x04bf, 13); // ld a,(0xa9ab)
  regs.cp(0x03); m.step(0x04c1, 7); // cp 0x03
  if (regs.fNZ) { m.ret(11); return; } // ret nz (taken)
  m.step(0x04c2, 5); // ret nz (not taken)

  regs.a = mem.read8(0xa9ac); m.step(0x04c5, 13); // ld a,(0xa9ac)
  regs.hl = 0x0832; m.step(0x04c8, 10); // ld hl,0x0832 -- ROM threshold
  regs.cp(mem.read8(regs.hl)); m.step(0x04c9, 7); // cp (hl)
  if (regs.fC) { m.ret(11); return; } // ret c (taken)
  m.step(0x04ca, 5); // ret c (not taken)

  regs.cp(0x08); m.step(0x04cc, 7); // cp 0x08
  if (regs.fNC) { m.ret(11); return; } // ret nc (taken)
  m.step(0x04cd, 5); // ret nc (not taken)

  regs.a = mem.read8(0xb411); m.step(0x04d0, 13); // ld a,(0xb411)
  regs.add(0x80); m.step(0x04d2, 7); // add a,0x80
  if (regs.fC) {
    m.step(0x04de, 12); // jr c,0x04de (taken) -- bit 7 was already set
  } else {
    m.step(0x04d4, 7); // jr c,0x04de (not taken)
    mem.write8(0xb411, regs.a); m.step(0x04d7, 13); // ld (0xb411),a
    regs.hl = 0xb010; m.step(0x04da, 10); // ld hl,0xb010
    regs.a = mem.read8(regs.hl); m.step(0x04db, 7); // ld a,(hl)
    regs.add(0x80); m.step(0x04dd, 7); // add a,0x80
    mem.write8(regs.hl, regs.a); m.step(0x04de, 7); // ld (hl),a
  }

  regs.a = mem.read8(0xb413); m.step(0x04e1, 13); // ld a,(0xb413)
  regs.add(0x80); m.step(0x04e3, 7); // add a,0x80
  if (regs.fC) {
    m.step(0x04ef, 12); // jr c,0x04ef (taken) -- bit 7 was already set
  } else {
    m.step(0x04e5, 7); // jr c,0x04ef (not taken)
    mem.write8(0xb413, regs.a); m.step(0x04e8, 13); // ld (0xb413),a
    regs.hl = 0xb012; m.step(0x04eb, 10); // ld hl,0xb012
    regs.a = mem.read8(regs.hl); m.step(0x04ec, 7); // ld a,(hl)
    regs.add(0x80); m.step(0x04ee, 7); // add a,0x80
    mem.write8(regs.hl, regs.a); m.step(0x04ef, 7); // ld (hl),a
  }

  regs.a = mem.read8(0xb415); m.step(0x04f2, 13); // ld a,(0xb415)
  regs.add(0x80); m.step(0x04f4, 7); // add a,0x80
  if (regs.fC) {
    m.step(0x0500, 12); // jr c,0x0500 (taken) -- bit 7 was already set
  } else {
    m.step(0x04f6, 7); // jr c,0x0500 (not taken)
    mem.write8(0xb415, regs.a); m.step(0x04f9, 13); // ld (0xb415),a
    regs.hl = 0xb014; m.step(0x04fc, 10); // ld hl,0xb014
    regs.a = mem.read8(regs.hl); m.step(0x04fd, 7); // ld a,(hl)
    regs.add(0x80); m.step(0x04ff, 7); // add a,0x80
    mem.write8(regs.hl, regs.a); m.step(0x0500, 7); // ld (hl),a
  }

  regs.a = mem.read8(0xb437); m.step(0x0503, 13); // ld a,(0xb437)
  regs.add(0x80); m.step(0x0505, 7); // add a,0x80
  if (regs.fC) {
    m.step(0x0511, 12); // jr c,0x0511 (taken) -- bit 7 was already set
  } else {
    m.step(0x0507, 7); // jr c,0x0511 (not taken)
    mem.write8(0xb437, regs.a); m.step(0x050a, 13); // ld (0xb437),a
    regs.hl = 0xb036; m.step(0x050d, 10); // ld hl,0xb036
    regs.a = mem.read8(regs.hl); m.step(0x050e, 7); // ld a,(hl)
    regs.add(0x80); m.step(0x0510, 7); // add a,0x80
    mem.write8(regs.hl, regs.a); m.step(0x0511, 7); // ld (hl),a
  }

  regs.a = mem.read8(0xb439); m.step(0x0514, 13); // ld a,(0xb439)
  regs.add(0x80); m.step(0x0516, 7); // add a,0x80
  if (regs.fC) {
    m.step(0x0522, 12); // jr c,0x0522 (taken) -- bit 7 was already set
  } else {
    m.step(0x0518, 7); // jr c,0x0522 (not taken)
    mem.write8(0xb439, regs.a); m.step(0x051b, 13); // ld (0xb439),a
    regs.hl = 0xb038; m.step(0x051e, 10); // ld hl,0xb038
    regs.a = mem.read8(regs.hl); m.step(0x051f, 7); // ld a,(hl)
    regs.add(0x80); m.step(0x0521, 7); // add a,0x80
    mem.write8(regs.hl, regs.a); m.step(0x0522, 7); // ld (hl),a
  }

  regs.a = mem.read8(0xb43b); m.step(0x0525, 13); // ld a,(0xb43b)
  regs.add(0x80); m.step(0x0527, 7); // add a,0x80
  if (regs.fC) {
    m.step(0x0533, 12); // jr c,0x0533 (taken) -- bit 7 was already set
  } else {
    m.step(0x0529, 7); // jr c,0x0533 (not taken)
    mem.write8(0xb43b, regs.a); m.step(0x052c, 13); // ld (0xb43b),a
    regs.hl = 0xb03a; m.step(0x052f, 10); // ld hl,0xb03a
    regs.a = mem.read8(regs.hl); m.step(0x0530, 7); // ld a,(hl)
    regs.add(0x80); m.step(0x0532, 7); // add a,0x80
    mem.write8(regs.hl, regs.a); m.step(0x0533, 7); // ld (hl),a
  }

  regs.a = mem.read8(0xb43d); m.step(0x0536, 13); // ld a,(0xb43d)
  regs.add(0x80); m.step(0x0538, 7); // add a,0x80
  if (regs.fC) {
    m.step(0x0544, 12); // jr c,0x0544 (taken) -- bit 7 was already set
  } else {
    m.step(0x053a, 7); // jr c,0x0544 (not taken)
    mem.write8(0xb43d, regs.a); m.step(0x053d, 13); // ld (0xb43d),a
    regs.hl = 0xb03c; m.step(0x0540, 10); // ld hl,0xb03c
    regs.a = mem.read8(regs.hl); m.step(0x0541, 7); // ld a,(hl)
    regs.add(0x80); m.step(0x0543, 7); // add a,0x80
    mem.write8(regs.hl, regs.a); m.step(0x0544, 7); // ld (hl),a
  }

  regs.a = mem.read8(0xb43f); m.step(0x0547, 13); // ld a,(0xb43f)
  regs.add(0x80); m.step(0x0549, 7); // add a,0x80
  if (regs.fC) {
    m.step(0x0555, 12); // jr c,0x0555 (taken) -- bit 7 was already set
  } else {
    m.step(0x054b, 7); // jr c,0x0555 (not taken)
    mem.write8(0xb43f, regs.a); m.step(0x054e, 13); // ld (0xb43f),a
    regs.hl = 0xb03e; m.step(0x0551, 10); // ld hl,0xb03e
    regs.a = mem.read8(regs.hl); m.step(0x0552, 7); // ld a,(hl)
    regs.add(0x80); m.step(0x0554, 7); // add a,0x80
    mem.write8(regs.hl, regs.a); m.step(0x0555, 7); // ld (hl),a
  }

  m.ret(10); // ret (0x0555)
}

export function loc_0365_0556(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl); m.step(0x0557, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x0559, 7); // add a,0x0f
  regs.cpl(); m.step(0x055a, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x055b, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x055c, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x055d, 4); // inc e
  ldi(m); m.step(0x055f, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0560, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x0562, 7); // add a,0x0f
  regs.cpl(); m.step(0x0563, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0564, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0565, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0566, 4); // inc e
  ldi(m); m.step(0x0568, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0569, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x056b, 7); // add a,0x0f
  regs.cpl(); m.step(0x056c, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x056d, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x056e, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x056f, 4); // inc e
  ldi(m); m.step(0x0571, 16); // ldi
  regs.hl = 0xaa10; m.step(0x0574, 10); // ld hl,0xaa10
  regs.a = mem.read8(regs.hl); m.step(0x0575, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x0577, 7); // add a,0x0f
  regs.cpl(); m.step(0x0578, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0579, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x057a, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x057b, 4); // inc e
  ldi(m); m.step(0x057d, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x057e, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x0580, 7); // add a,0x0f
  regs.cpl(); m.step(0x0581, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0582, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0583, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0584, 4); // inc e
  ldi(m); m.step(0x0586, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0587, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x0589, 7); // add a,0x0f
  regs.cpl(); m.step(0x058a, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x058b, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x058c, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x058d, 4); // inc e
  ldi(m); m.step(0x058f, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0590, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x0592, 7); // add a,0x0f
  regs.cpl(); m.step(0x0593, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0594, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0595, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0596, 4); // inc e
  ldi(m); m.step(0x0598, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0599, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x059b, 7); // add a,0x0f
  regs.cpl(); m.step(0x059c, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x059d, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x059e, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x059f, 4); // inc e
  ldi(m); m.step(0x05a1, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x05a2, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x05a4, 7); // add a,0x0f
  regs.cpl(); m.step(0x05a5, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x05a6, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x05a7, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x05a8, 4); // inc e
  ldi(m); m.step(0x05aa, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x05ab, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x05ad, 7); // add a,0x0f
  regs.cpl(); m.step(0x05ae, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x05af, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x05b0, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x05b1, 4); // inc e
  ldi(m); m.step(0x05b3, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x05b4, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x05b6, 7); // add a,0x0f
  regs.cpl(); m.step(0x05b7, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x05b8, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x05b9, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x05ba, 4); // inc e
  ldi(m); m.step(0x05bc, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x05bd, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x05bf, 7); // add a,0x0f
  regs.cpl(); m.step(0x05c0, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x05c1, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x05c2, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x05c3, 4); // inc e
  ldi(m); m.step(0x05c5, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x05c6, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x05c8, 7); // add a,0x0f
  regs.cpl(); m.step(0x05c9, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x05ca, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x05cb, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x05cc, 4); // inc e
  ldi(m); m.step(0x05ce, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x05cf, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x05d1, 7); // add a,0x0f
  regs.cpl(); m.step(0x05d2, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x05d3, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x05d4, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x05d5, 4); // inc e
  ldi(m); m.step(0x05d7, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x05d8, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x05da, 7); // add a,0x0f
  regs.cpl(); m.step(0x05db, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x05dc, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x05dd, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x05de, 4); // inc e
  ldi(m); m.step(0x05e0, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x05e1, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x05e3, 7); // add a,0x0f
  regs.cpl(); m.step(0x05e4, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x05e5, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x05e6, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x05e7, 4); // inc e
  ldi(m); m.step(0x05e9, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x05ea, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x05ec, 7); // add a,0x0f
  regs.cpl(); m.step(0x05ed, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x05ee, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x05ef, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x05f0, 4); // inc e
  ldi(m); m.step(0x05f2, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x05f3, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x05f5, 7); // add a,0x0f
  regs.cpl(); m.step(0x05f6, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x05f7, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x05f8, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x05f9, 4); // inc e
  ldi(m); m.step(0x05fb, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x05fc, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x05fe, 7); // add a,0x0f
  regs.cpl(); m.step(0x05ff, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0600, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0601, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0602, 4); // inc e
  ldi(m); m.step(0x0604, 16); // ldi
  regs.hl = 0xaa36; m.step(0x0607, 10); // ld hl,0xaa36
  regs.a = mem.read8(regs.hl); m.step(0x0608, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x060a, 7); // add a,0x0f
  regs.cpl(); m.step(0x060b, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x060c, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x060d, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x060e, 4); // inc e
  ldi(m); m.step(0x0610, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0611, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x0613, 7); // add a,0x0f
  regs.cpl(); m.step(0x0614, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0615, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0616, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0617, 4); // inc e
  ldi(m); m.step(0x0619, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x061a, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x061c, 7); // add a,0x0f
  regs.cpl(); m.step(0x061d, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x061e, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x061f, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0620, 4); // inc e
  ldi(m); m.step(0x0622, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x0623, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x0625, 7); // add a,0x0f
  regs.cpl(); m.step(0x0626, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0627, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0628, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0629, 4); // inc e
  ldi(m); m.step(0x062b, 16); // ldi
  regs.a = mem.read8(regs.hl); m.step(0x062c, 7); // ld a,(hl)
  regs.add(0x0f); m.step(0x062e, 7); // add a,0x0f
  regs.cpl(); m.step(0x062f, 4); // cpl
  mem.write8(regs.de, regs.a); m.step(0x0630, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0631, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0632, 4); // inc e
  ldi(m); m.step(0x0634, 16); // ldi
  regs.hl = 0xaa60; m.step(0x0637, 10); // ld hl,0xaa60
  regs.de = 0xb410; m.step(0x063a, 10); // ld de,0xb410
  regs.a = mem.read8(regs.hl); m.step(0x063b, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x063d, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x063e, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x063f, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0640, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0641, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x0642, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x0643, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0644, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0645, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0646, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x0648, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x0649, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x064a, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x064b, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x064c, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x064d, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x064e, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x064f, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0650, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0651, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x0653, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x0654, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0655, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0656, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0657, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x0658, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x0659, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x065a, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x065b, 4); // inc e
  regs.hl = 0xaa40; m.step(0x065e, 10); // ld hl,0xaa40
  regs.a = mem.read8(regs.hl); m.step(0x065f, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x0661, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x0662, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0663, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0664, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0665, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x0666, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x0667, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0668, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0669, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x066a, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x066c, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x066d, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x066e, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x066f, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0670, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x0671, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x0672, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0673, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0674, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0675, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x0677, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x0678, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0679, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x067a, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x067b, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x067c, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x067d, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x067e, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x067f, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0680, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x0682, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x0683, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0684, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0685, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0686, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x0687, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x0688, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0689, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x068a, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x068b, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x068d, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x068e, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x068f, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0690, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0691, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x0692, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x0693, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0694, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0695, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0696, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x0698, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x0699, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x069a, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x069b, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x069c, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x069d, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x069e, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x069f, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06a0, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06a1, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x06a3, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x06a4, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06a5, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06a6, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06a7, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x06a8, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x06a9, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06aa, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06ab, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06ac, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x06ae, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x06af, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06b0, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06b1, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06b2, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x06b3, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x06b4, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06b5, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06b6, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06b7, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x06b9, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x06ba, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06bb, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06bc, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06bd, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x06be, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x06bf, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06c0, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06c1, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06c2, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x06c4, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x06c5, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06c6, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06c7, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06c8, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x06c9, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x06ca, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06cb, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06cc, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06cd, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x06cf, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x06d0, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06d1, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06d2, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06d3, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x06d4, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x06d5, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06d6, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06d7, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06d8, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x06da, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x06db, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06dc, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06dd, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06de, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x06df, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x06e0, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06e1, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06e2, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06e3, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x06e5, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x06e6, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06e7, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06e8, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06e9, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x06ea, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x06eb, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06ec, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06ed, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06ee, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x06f0, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x06f1, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06f2, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06f3, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06f4, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x06f5, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x06f6, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06f7, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06f8, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06f9, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x06fb, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x06fc, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x06fd, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x06fe, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x06ff, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x0700, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x0701, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0702, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0703, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0704, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x0706, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x0707, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0708, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0709, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x070a, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x070b, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x070c, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x070d, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x070e, 4); // inc e
  regs.hl = 0xaa66; m.step(0x0711, 10); // ld hl,0xaa66
  regs.a = mem.read8(regs.hl); m.step(0x0712, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x0714, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x0715, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0716, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0717, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0718, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x0719, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x071a, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x071b, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x071c, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x071d, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x071f, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x0720, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0721, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0722, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0723, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x0724, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x0725, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0726, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0727, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0728, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x072a, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x072b, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x072c, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x072d, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x072e, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x072f, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x0730, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0731, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0732, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0733, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x0735, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x0736, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0737, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0738, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0739, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x073a, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x073b, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x073c, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x073d, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x073e, 7); // ld a,(hl)
  regs.xor(0xc0); m.step(0x0740, 7); // xor 0xc0
  mem.write8(regs.de, regs.a); m.step(0x0741, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0742, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0743, 4); // inc e
  regs.a = mem.read8(regs.hl); m.step(0x0744, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a); m.step(0x0745, 4); // inc a
  mem.write8(regs.de, regs.a); m.step(0x0746, 7); // ld (de),a
  regs.l = regs.inc8(regs.l); m.step(0x0747, 4); // inc l
  regs.e = regs.inc8(regs.e); m.step(0x0748, 4); // inc e

  m.step(0x04bc, 10); // 0748  jp 0x04bc
  return loc_0365_04bc(m);
}
