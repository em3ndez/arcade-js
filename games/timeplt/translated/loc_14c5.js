// SPDX-License-Identifier: GPL-3.0-only

// loc_14c5  (ROM 0x14C5-0x1562, Time Pilot)
export function loc_14c5(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9f4);
  m.step(0x14c8, 13); // ld a,(0xa9f4)

  regs.bit(0, regs.a);
  m.step(0x14ca, 8); // bit 0,a

  if (regs.fZ) {
    m.step(0x153b, 12); // jr z,0x153b (taken) -- the blanking pass

    regs.a = 0xf1;
    m.step(0x153d, 7); // ld a,0xf1

    regs.hl = 0xa7b1;
    m.step(0x1540, 10); // ld hl,0xa7b1

    m.push16(0x1543);
    m.step(0x1319, 17); // call 0x1319
    m.call(0x1319);

    regs.hl = 0xa5d1;
    m.step(0x1546, 10); // ld hl,0xa5d1

    m.push16(0x1549);
    m.step(0x1319, 17); // call 0x1319 -- returns with DE = 0xFFE0
    m.call(0x1319);

    regs.hl = 0xa610;
    m.step(0x154c, 10); // ld hl,0xa610

    mem.write8(regs.hl, regs.a);
    m.step(0x154d, 7); // ld (hl),a

    regs.addHl(regs.de);
    m.step(0x154e, 11); // add hl,de -- HL -= 0x20, one row

    mem.write8(regs.hl, regs.a);
    m.step(0x154f, 7); // ld (hl),a

    regs.hl = 0xa611;
    m.step(0x1552, 10); // ld hl,0xa611

    mem.write8(regs.hl, regs.a);
    m.step(0x1553, 7); // ld (hl),a

    regs.addHl(regs.de);
    m.step(0x1554, 11); // add hl,de

    mem.write8(regs.hl, regs.a);
    m.step(0x1555, 7); // ld (hl),a

    regs.hl = 0xa612;
    m.step(0x1558, 10); // ld hl,0xa612

    mem.write8(regs.hl, regs.a);
    m.step(0x1559, 7); // ld (hl),a

    regs.addHl(regs.de);
    m.step(0x155a, 11); // add hl,de

    mem.write8(regs.hl, regs.a);
    m.step(0x155b, 7); // ld (hl),a
  } else {
    m.step(0x14cc, 7); // jr z,0x153b (not taken) -- the drawing pass

    regs.hl = mem.read16(0xa9f7);
    m.step(0x14cf, 16); // ld hl,(0xa9f7)

    regs.a = mem.read8(regs.hl);
    m.step(0x14d0, 7); // ld a,(hl)

    regs.and(0xfe);
    m.step(0x14d2, 7); // and 0xfe -- any bit above bit 0 ends the walk

    if (!regs.fZ) {
      m.step(0x14d4, 7); // jr z,0x14e9 (not taken) -- end of the script

      regs.a = 0x00;
      m.step(0x14d6, 7); // ld a,0x00

      mem.write8(0xa9f4, regs.a);
      m.step(0x14d9, 13); // ld (0xa9f4),a

      regs.a = 0x04;
      m.step(0x14db, 7); // ld a,0x04

      mem.write8(0xa9f0, regs.a);
      m.step(0x14de, 13); // ld (0xa9f0),a -- advance to step 4

      m.push16(0x14e1);
      m.step(0x56e4, 17); // call 0x56e4
      m.call(0x56e4);

      regs.hl = mem.read16(0xa9f7);
      m.step(0x14e4, 16); // ld hl,(0xa9f7)

      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x14e5, 6); // inc hl -- no flags

      mem.write16(0xa9f7, regs.hl);
      m.step(0x14e8, 16); // ld (0xa9f7),hl

      m.ret(); // 14e8  ret
      return;
    }
    m.step(0x14e9, 12); // jr z,0x14e9 (taken)

    m.push16(0x14ec);
    m.step(0x1563, 17); // call 0x1563
    m.call(0x1563);

    regs.c = 0x01;
    m.step(0x14ee, 7); // ld c,0x01

    regs.de = 0xa451;
    m.step(0x14f1, 10); // ld de,0xa451

    m.push16(0x14f4);
    m.step(0x4a9d, 17); // call 0x4a9d
    m.call(0x4a9d);

    regs.hl = mem.read16(0xa9f7);
    m.step(0x14f7, 16); // ld hl,(0xa9f7)

    regs.de = 0x000d;
    m.step(0x14fa, 10); // ld de,0x000d

    regs.addHl(regs.de);
    m.step(0x14fb, 11); // add hl,de -- advance the script pointer by 13

    mem.write16(0xa9f7, regs.hl);
    m.step(0x14fe, 16); // ld (0xa9f7),hl

    regs.c = 0x03;
    m.step(0x1500, 7); // ld c,0x03

    regs.de = 0xa7b1;
    m.step(0x1503, 10); // ld de,0xa7b1

    m.push16(0x1506);
    m.step(0x4a9d, 17); // call 0x4a9d
    m.call(0x4a9d);

    regs.hl = mem.read16(0xa9f7);
    m.step(0x1509, 16); // ld hl,(0xa9f7)

    regs.a = mem.read8(regs.hl);
    m.step(0x150a, 7); // ld a,(hl)

    regs.and(0x01);
    m.step(0x150c, 7); // and 0x01

    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x150d, 6); // dec hl -- no flags

    mem.write16(0xa9f7, regs.hl);
    m.step(0x1510, 16); // ld (0xa9f7),hl -- no flags

    if (regs.fZ) {
      m.step(0x151b, 12); // jr z,0x151b (taken)
    } else {
      m.step(0x1512, 7); // jr z,0x151b (not taken)

      regs.de = 0x0020;
      m.step(0x1515, 10); // ld de,0x0020 -- one tilemap row

      regs.hl = 0xa5f1;
      m.step(0x1518, 10); // ld hl,0xa5f1

      regs.decMem8(mem, regs.hl);
      m.step(0x1519, 11); // dec (hl)

      regs.addHl(regs.de);
      m.step(0x151a, 11); // add hl,de

      regs.decMem8(mem, regs.hl);
      m.step(0x151b, 11); // dec (hl)
    }

    regs.hl = mem.read16(0xa9f7);
    m.step(0x151e, 16); // ld hl,(0xa9f7)

    regs.a = mem.read8(regs.hl);
    m.step(0x151f, 7); // ld a,(hl)

    regs.and(0x01);
    m.step(0x1521, 7); // and 0x01

    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x1522, 6); // dec hl -- no flags

    mem.write16(0xa9f7, regs.hl);
    m.step(0x1525, 16); // ld (0xa9f7),hl -- no flags

    if (regs.fZ) {
      m.step(0x1536, 12); // jr z,0x1536 (taken)
    } else {
      m.step(0x1527, 7); // jr z,0x1536 (not taken)

      regs.de = 0x0020;
      m.step(0x152a, 10); // ld de,0x0020

      regs.hl = 0xa5f0;
      m.step(0x152d, 10); // ld hl,0xa5f0

      regs.decMem8(mem, regs.hl);
      m.step(0x152e, 11); // dec (hl)

      regs.addHl(regs.de);
      m.step(0x152f, 11); // add hl,de

      regs.decMem8(mem, regs.hl);
      m.step(0x1530, 11); // dec (hl)

      regs.hl = 0xa5f2;
      m.step(0x1533, 10); // ld hl,0xa5f2

      regs.decMem8(mem, regs.hl);
      m.step(0x1534, 11); // dec (hl)

      regs.addHl(regs.de);
      m.step(0x1535, 11); // add hl,de

      regs.decMem8(mem, regs.hl);
      m.step(0x1536, 11); // dec (hl)
    }

    m.push16(0x1539);
    m.step(0x158c, 17); // call 0x158c
    m.call(0x158c);

    m.step(0x155b, 12); // jr 0x155b
  }

  regs.a = mem.read8(0xa9f4);
  m.step(0x155e, 13); // ld a,(0xa9f4)

  regs.a = regs.dec8(regs.a);
  m.step(0x155f, 4); // dec a

  mem.write8(0xa9f4, regs.a);
  m.step(0x1562, 13); // ld (0xa9f4),a

  m.ret(); // 1562  ret
}
