// SPDX-License-Identifier: GPL-3.0-only

// loc_2010  (ROM 0x2010–0x20AE)
function loc_2063(m) {
  m.step(0x1f2e, 10); // jp 0x1f2e -- TAIL, does not return here
  return m.call(0x1f2e);
}

export function loc_2010(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x2013, 19); // ld a,(ix+0x00)
  regs.cp(0xb4);
  m.step(0x2015, 7); // cp 0xb4

  if (!regs.fC) {
    m.step(0x2017, 7); // jr c not taken -- (ix+0x00) >= 0xb4, clamp it

    mem.write8((regs.ix + 0x00) & 0xffff, 0xb4);
    m.step(0x201b, 19); // ld (ix+0x00),0xb4
    mem.write8((regs.iy + 0x01) & 0xffff, 0xff);
    m.step(0x201f, 19); // ld (iy+0x01),0xff
    regs.a = mem.read8(0xad04);
    m.step(0x2022, 13); // ld a,(0xad04)
    regs.cp(0x02);
    m.step(0x2024, 7); // cp 0x02
    if (!regs.fC) {
      m.push16(0x2027);
      m.step(0x5679, 17); // call nc,0x5679 taken
      m.call(0x5679);
    } else {
      m.step(0x2027, 10); // call nc not taken
    }

    m.push16(0x202a);
    m.step(0x56d2, 17); // call 0x56d2
    m.call(0x56d2);

    regs.a = mem.read8(0xabfe);
    m.step(0x202d, 13); // ld a,(0xabfe)
    regs.cp(0xa5);
    m.step(0x202f, 7); // cp 0xa5
    if (regs.fNZ) {
      m.step(0x2063, 10); // jp nz,0x2063
      return loc_2063(m);
    }
    m.step(0x2032, 10); // jp nz not taken

    regs.de = 0xabff;
    m.step(0x2035, 10); // ld de,0xabff
    regs.a = mem.read8(regs.de);
    m.step(0x2036, 7); // ld a,(de)
    regs.cp(0x05);
    m.step(0x2038, 7); // cp 0x05
    if (regs.fZ) {
      m.step(0x2040, 10); // jp z,0x2040
    } else {
      m.step(0x203b, 10); // jp z not taken
      regs.cp(0x10);
      m.step(0x203d, 7); // cp 0x10
      if (regs.fNZ) {
        m.step(0x2063, 10); // jp nz,0x2063
        return loc_2063(m);
      }
      m.step(0x2040, 10); // jp nz not taken -- falls into loc_2040
    }
  } else {
    m.step(0x2040, 12); // jr c,0x2040 taken
  }

  regs.decMem8(mem, (regs.ix + 0x00) & 0xffff);
  m.step(0x2043, 23); // dec (ix+0x00)
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x2046, 19); // ld a,(ix+0x00)

  let arm = null;
  for (const [v, jrAddr, target, nextCp] of [
    [0xb3, 0x2048, 0x2066, 0x204a],
    [0xab, 0x204c, 0x206b, 0x204e],
    [0xa3, 0x2050, 0x2070, 0x2052],
    [0x9b, 0x2054, 0x2075, 0x2056],
    [0x93, 0x2058, 0x207a, 0x205a],
    [0x8b, 0x205c, 0x207f, 0x205e],
    [0x83, 0x2060, 0x2084, 0x2062],
  ]) {
    regs.cp(v);
    m.step(jrAddr, 7); // cp v
    if (regs.fZ) {
      m.step(target, 12); // jr z taken
      arm = target;
      break;
    }
    m.step(nextCp, 7); // jr z not taken
  }

  if (arm === null) {
    m.ret(); // 0x2062 -- no arm matched
    return;
  }

  const [deValue, jrAddr] = {
    0x2066: [0x1f76, 0x2069],
    0x206b: [0x1f94, 0x206e],
    0x2070: [0x1fb2, 0x2073],
    0x2075: [0x1fd0, 0x2078],
    0x207a: [0x1fd0, 0x207d],
    0x207f: [0x1fb2, 0x2082],
    0x2084: [0x1fee, 0x2087],
  }[arm];
  regs.de = deValue;
  m.step(jrAddr, 10); // ld de,NNNN
  m.step(0x2089, 12); // jr 0x2089

  regs.hl = 0xa5af;
  m.step(0x208c, 10); // ld hl,0xa5af
  regs.b = 0xc1;
  m.step(0x208e, 7); // ld b,0xc1
  regs.a = mem.read8(0xad04);
  m.step(0x2091, 13); // ld a,(0xad04)
  regs.add(regs.b);
  m.step(0x2092, 4); // add a,b
  regs.c = regs.a;
  m.step(0x2093, 4); // ld c,a
  regs.exx(); // BC/DE/HL <-> BC'/DE'/HL'
  m.step(0x2094, 4); // exx
  regs.a = mem.read8(0x337a); // ROM
  m.step(0x2097, 13); // ld a,(0x337a)
  regs.b = regs.a; // the OUTER counter, in the alternate set
  m.step(0x2098, 4); // ld b,a

  do {
    regs.exx();
    m.step(0x2099, 4); // exx -- back to the cursor/colour/source set
    regs.a = mem.read8(0x4902); // ROM
    m.step(0x209c, 13); // ld a,(0x4902)
    regs.b = regs.a; // the INNER counter
    m.step(0x209d, 4); // ld b,a

    do {
      regs.a = mem.read8(regs.de);
      m.step(0x209e, 7); // ld a,(de)
      mem.write8(regs.hl, regs.a);
      m.step(0x209f, 7); // ld (hl),a
      regs.h = regs.res(2, regs.h); // HL -= 0x0400: video RAM -> colour RAM
      m.step(0x20a1, 8); // res 2,h
      mem.write8(regs.hl, regs.c);
      m.step(0x20a2, 7); // ld (hl),c
      regs.h = regs.set(2, regs.h); // back to video RAM
      m.step(0x20a4, 8); // set 2,h
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x20a5, 6); // inc hl
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x20a6, 6); // inc de
      regs.djnz(); // djnz -- no flags
      m.step(regs.b !== 0 ? 0x209d : 0x20a8, regs.b !== 0 ? 13 : 8); // djnz 0x209d
    } while (regs.b !== 0);

    regs.a = 0x1b;
    m.step(0x20aa, 7); // ld a,0x1b
    m.push16(0x20ab);
    m.step(0x0018, 11); // rst 0x18 -- HL += 0x1b
    m.call(0x0018);
    regs.exx();
    m.step(0x20ac, 4); // exx -- back to the outer counter
    regs.djnz(); // djnz -- no flags
    m.step(regs.b !== 0 ? 0x2098 : 0x20ae, regs.b !== 0 ? 13 : 8); // djnz 0x2098
  } while (regs.b !== 0);

  m.ret(); // 0x20ae
}
