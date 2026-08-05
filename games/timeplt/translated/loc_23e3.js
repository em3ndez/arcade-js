// SPDX-License-Identifier: GPL-3.0-only

// loc_23e3  (ROM 0x23E3–0x2508)
export function loc_23e3(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(0xa800);
  m.step(0x23e6, 13); // ld a,(0xa800)
  regs.a = regs.inc8(regs.a);
  m.step(0x23e7, 4); // inc a
  if (regs.fNZ) {
    m.step(0x2496, 10); // jp nz,0x2496 (taken)
    return loc_23e3_2496(m);
  }
  m.step(0x23ea, 10); // jp nz,0x2496 (not taken)

  regs.a = mem.read8(0xacc6);
  m.step(0x23ed, 13); // ld a,(0xacc6)
  regs.and(regs.a);
  m.step(0x23ee, 4); // and a
  if (regs.fNZ) {
    m.step(0x2496, 10); // jp nz,0x2496 (taken)
    return loc_23e3_2496(m);
  }
  m.step(0x23f1, 10); // jp nz,0x2496 (not taken)

  m.push16(0x23f4);
  m.step(0x1ed1, 17); // call 0x1ed1 -- byte comes back in A
  m.call(0x1ed1);

  regs.rlca();
  m.step(0x23f5, 4); // rlca
  regs.rlca();
  m.step(0x23f6, 4); // rlca
  regs.rlca();
  m.step(0x23f7, 4); // rlca
  regs.rlca(); // carry now holds what was bit 4 of A
  m.step(0x23f8, 4); // rlca

  regs.hl = 0xa98e;
  m.step(0x23fb, 10); // ld hl,0xa98e
  mem.write8(regs.hl, regs.rl(mem.read8(regs.hl))); // shifts the carry in
  m.step(0x23fd, 15); // rl (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x23fe, 7); // ld a,(hl)
  regs.and(0x03);
  m.step(0x2400, 7); // and 0x03
  regs.cp(0x01);
  m.step(0x2402, 7); // cp 0x01
  regs.hl = 0xaa81;
  m.step(0x2405, 10); // ld hl,0xaa81

  if (regs.fNZ) {
    m.step(0x2409, 12); // jr nz,0x2409 (taken)
  } else {
    m.step(0x2407, 7); // jr nz,0x2409 (not taken)
    mem.write8(regs.hl, 0x03); // arm 3 spawns
    m.step(0x2409, 10); // ld (hl),0x03
  }

  regs.a = mem.read8(0xad30);
  m.step(0x240c, 13); // ld a,(0xad30)
  regs.and(regs.a);
  m.step(0x240d, 4); // and a
  if (regs.fZ) {
    m.step(0x2414, 12); // jr z,0x2414 (taken)
  } else {
    m.step(0x240f, 7); // jr z,0x2414 (not taken)
    regs.a = mem.read8(regs.hl); // (0xAA81)
    m.step(0x2410, 7); // ld a,(hl)
    regs.and(regs.a);
    m.step(0x2411, 4); // and a
    if (regs.fZ) {
      m.step(0x2496, 10); // jp z,0x2496 (taken) -- nothing armed
      return loc_23e3_2496(m);
    }
    m.step(0x2414, 10); // jp z,0x2496 (not taken)
  }

  regs.hl = (regs.hl + 1) & 0xffff; // -> 0xAA82
  m.step(0x2415, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x2416, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x2417, 4); // and a
  if (regs.fNZ) {
    m.step(0x2496, 10); // jp nz,0x2496 (taken) -- cooldown still running
    return loc_23e3_2496(m);
  }
  m.step(0x241a, 10); // jp nz,0x2496 (not taken)

  regs.ix = 0xaa80;
  m.step(0x241e, 14); // ld ix,0xaa80
  regs.b = 0x06;
  m.step(0x2420, 7); // ld b,0x06

  do {
    regs.a = mem.read8(R(0x00));
    m.step(0x2423, 19); // ld a,(ix+0x00)
    regs.and(regs.a);
    m.step(0x2424, 4); // and a
    if (regs.fZ) {
      m.step(0x2449, 12); // jr z,0x2449 (taken) -- free slot found
      return loc_23e3_2449(m);
    }
    m.step(0x2426, 7); // jr z,0x2449 (not taken)
    regs.de = mem.read16(0x0d46); // the stride, from ROM
    m.step(0x242a, 20); // ld de,(0x0d46)
    regs.addIx(regs.de);
    m.step(0x242c, 15); // add ix,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x2420 : 0x242e, regs.b !== 0 ? 13 : 8); // djnz 0x2420
  } while (regs.b !== 0);

  m.step(0x2496, 10); // jp 0x2496 -- table full
  return loc_23e3_2496(m);
}

export function loc_23e3_2449(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  m.push16(0x244c);
  m.step(0x567e, 17); // call 0x567e
  m.call(0x567e);

  regs.xor(regs.a); // A = 0 and carry cleared
  m.step(0x244d, 4); // xor a
  regs.h = regs.a;
  m.step(0x244e, 4); // ld h,a
  regs.l = regs.a; // HL = 0
  m.step(0x244f, 4); // ld l,a
  regs.bc = mem.read16(0xa808);
  m.step(0x2453, 20); // ld bc,(0xa808)
  regs.sbcHl(regs.bc); // HL = -(0xA808)
  m.step(0x2455, 15); // sbc hl,bc
  regs.addHl(regs.hl);
  m.step(0x2456, 11); // add hl,hl
  regs.addHl(regs.hl); // * 4
  m.step(0x2457, 11); // add hl,hl
  mem.write8(R(0x0a), regs.l);
  m.step(0x245a, 19); // ld (ix+0x0a),l
  mem.write8(R(0x0b), regs.h);
  m.step(0x245d, 19); // ld (ix+0x0b),h

  regs.xor(regs.a); // again: A = 0 and carry cleared
  m.step(0x245e, 4); // xor a
  regs.h = regs.a;
  m.step(0x245f, 4); // ld h,a
  regs.l = regs.a;
  m.step(0x2460, 4); // ld l,a
  regs.bc = mem.read16(0xa80a);
  m.step(0x2464, 20); // ld bc,(0xa80a)
  regs.sbcHl(regs.bc); // HL = -(0xA80A)
  m.step(0x2466, 15); // sbc hl,bc
  regs.addHl(regs.hl);
  m.step(0x2467, 11); // add hl,hl
  regs.addHl(regs.hl);
  m.step(0x2468, 11); // add hl,hl
  mem.write8(R(0x0c), regs.l);
  m.step(0x246b, 19); // ld (ix+0x0c),l
  mem.write8(R(0x0d), regs.h);
  m.step(0x246e, 19); // ld (ix+0x0d),h

  regs.a = mem.read8(0xa802);
  m.step(0x2471, 13); // ld a,(0xa802)
  regs.add(0x04); // round before the divide
  m.step(0x2473, 7); // add a,0x04
  regs.rrca();
  m.step(0x2474, 4); // rrca
  regs.rrca();
  m.step(0x2475, 4); // rrca
  regs.rrca(); // A / 8
  m.step(0x2476, 4); // rrca
  regs.and(0x1f); // 32 directions
  m.step(0x2478, 7); // and 0x1f
  regs.hl = 0x2771; // the 64-byte ROM word table
  m.step(0x247b, 10); // ld hl,0x2771
  m.push16(0x247e);
  m.step(0x018c, 17); // call 0x018c -- table fetch -> DE
  m.call(0x018c);

  regs.decMem8(mem, R(0x00)); // 0x00 -> 0xFF: slot now live
  m.step(0x2481, 23); // dec (ix+0x00)
  mem.write8(R(0x03), 0x00);
  m.step(0x2485, 19); // ld (ix+0x03),0x00
  mem.write8(R(0x04), regs.e);
  m.step(0x2488, 19); // ld (ix+0x04),e
  mem.write8(R(0x05), 0x00);
  m.step(0x248c, 19); // ld (ix+0x05),0x00
  mem.write8(R(0x06), regs.d);
  m.step(0x248f, 19); // ld (ix+0x06),d

  regs.hl = 0xaa81;
  m.step(0x2492, 10); // ld hl,0xaa81
  regs.decMem8(mem, regs.hl); // one fewer spawn armed
  m.step(0x2493, 11); // dec (hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2494, 6); // inc hl
  mem.write8(regs.hl, 0x06); // 0xAA82 = cooldown
  m.step(0x2496, 10); // ld (hl),0x06

  return loc_23e3_2496(m); // falls through into 0x2496
}

export function loc_23e3_2496(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(0xaa82);
  m.step(0x2499, 13); // ld a,(0xaa82)
  regs.and(regs.a);
  m.step(0x249a, 4); // and a
  if (regs.fZ) {
    m.step(0x24a0, 12); // jr z,0x24a0 (taken)
  } else {
    m.step(0x249c, 7); // jr z,0x24a0 (not taken)
    regs.a = regs.dec8(regs.a);
    m.step(0x249d, 4); // dec a
    mem.write8(0xaa82, regs.a);
    m.step(0x24a0, 13); // ld (0xaa82),a
  }

  regs.ix = 0xaa80;
  m.step(0x24a4, 14); // ld ix,0xaa80
  regs.b = 0x06;
  m.step(0x24a6, 7); // ld b,0x06

  const cull24fc = () => {
    regs.xor(regs.a);
    m.step(0x24fd, 4); // xor a
    mem.write8(R(0x00), regs.a);
    m.step(0x2500, 19); // ld (ix+0x00),a
    mem.write8(R(0x04), regs.a);
    m.step(0x2503, 19); // ld (ix+0x04),a
    mem.write8(R(0x06), regs.a);
    m.step(0x2506, 19); // ld (ix+0x06),a
    m.step(0x24f3, 10); // jp 0x24f3
  };

  do {
    body: {
      regs.exx(); // park B; the body works in the shadow set
      m.step(0x24a7, 4); // exx
      regs.a = mem.read8(R(0x00));
      m.step(0x24aa, 19); // ld a,(ix+0x00)
      regs.and(regs.a);
      m.step(0x24ab, 4); // and a
      if (regs.fZ) {
        m.step(0x24f3, 12); // jr z,0x24f3 (taken) -- free slot
        break body;
      }
      m.step(0x24ad, 7); // jr z,0x24f3 (not taken)
      regs.a = regs.inc8(regs.a);
      m.step(0x24ae, 4); // inc a
      if (regs.fNZ) {
        m.step(0x24fc, 12); // jr nz,0x24fc (taken) -- slot value not 0xFF
        cull24fc();
        break body;
      }
      m.step(0x24b0, 7); // jr nz,0x24fc (not taken)

      regs.l = mem.read8(R(0x0a));
      m.step(0x24b3, 19); // ld l,(ix+0x0a)
      regs.h = mem.read8(R(0x0b));
      m.step(0x24b6, 19); // ld h,(ix+0x0b)
      regs.de = mem.read16(0xa808);
      m.step(0x24ba, 20); // ld de,(0xa808)
      regs.addHl(regs.de);
      m.step(0x24bb, 11); // add hl,de
      regs.d = mem.read8(R(0x04));
      m.step(0x24be, 19); // ld d,(ix+0x04)
      regs.e = mem.read8(R(0x03));
      m.step(0x24c1, 19); // ld e,(ix+0x03)
      regs.addHl(regs.de);
      m.step(0x24c2, 11); // add hl,de
      regs.a = regs.h;
      m.step(0x24c3, 4); // ld a,h
      regs.add(0x10); // bias for the range test
      m.step(0x24c5, 7); // add a,0x10
      regs.cp(0x10);
      m.step(0x24c7, 7); // cp 0x10
      if (regs.fC) {
        m.step(0x24fc, 10); // jp c,0x24fc (taken) -- off-field
        cull24fc();
        break body;
      }
      m.step(0x24ca, 10); // jp c,0x24fc (not taken)
      mem.write8(R(0x04), regs.h);
      m.step(0x24cd, 19); // ld (ix+0x04),h
      mem.write8(R(0x03), regs.l);
      m.step(0x24d0, 19); // ld (ix+0x03),l

      regs.l = mem.read8(R(0x0c));
      m.step(0x24d3, 19); // ld l,(ix+0x0c)
      regs.h = mem.read8(R(0x0d));
      m.step(0x24d6, 19); // ld h,(ix+0x0d)
      regs.de = mem.read16(0xa80a);
      m.step(0x24da, 20); // ld de,(0xa80a)
      regs.addHl(regs.de);
      m.step(0x24db, 11); // add hl,de
      regs.d = mem.read8(R(0x06));
      m.step(0x24de, 19); // ld d,(ix+0x06)
      regs.e = mem.read8(R(0x05));
      m.step(0x24e1, 19); // ld e,(ix+0x05)
      regs.addHl(regs.de);
      m.step(0x24e2, 11); // add hl,de
      regs.a = regs.h;
      m.step(0x24e3, 4); // ld a,h
      regs.add(0x08);
      m.step(0x24e5, 7); // add a,0x08
      regs.cp(0x18);
      m.step(0x24e7, 7); // cp 0x18
      if (regs.fC) {
        m.step(0x24fc, 10); // jp c,0x24fc (taken) -- off-field
        cull24fc();
        break body;
      }
      m.step(0x24ea, 10); // jp c,0x24fc (not taken)
      mem.write8(R(0x06), regs.h);
      m.step(0x24ed, 19); // ld (ix+0x06),h
      mem.write8(R(0x05), regs.l);
      m.step(0x24f0, 19); // ld (ix+0x05),l

      m.push16(0x24f3);
      m.step(0x5337, 17); // call 0x5337
      m.call(0x5337);
    }

    regs.de = 0x0010;
    m.step(0x24f6, 10); // ld de,0x0010
    regs.addIx(regs.de);
    m.step(0x24f8, 15); // add ix,de
    regs.exx(); // B back in the main set
    m.step(0x24f9, 4); // exx
    regs.djnz();
    m.step(regs.b !== 0 ? 0x24a6 : 0x24fb, regs.b !== 0 ? 13 : 8); // djnz 0x24a6
  } while (regs.b !== 0);

  m.ret(10); // ret (0x24FB)
}
