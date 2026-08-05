// SPDX-License-Identifier: GPL-3.0-only

// loc_142a  (ROM 0x142A-0x14C4, Time Pilot)
export function loc_142a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9f2);
  m.step(0x142d, 13); // ld a,(0xa9f2)

  regs.bit(0, regs.a);
  m.step(0x142f, 8); // bit 0,a

  if (regs.fZ) {
    m.step(0x149d, 12); // jr z,0x149d (taken) -- the blanking pass

    regs.a = 0xf1;
    m.step(0x149f, 7); // ld a,0xf1

    regs.hl = 0xa7b1;
    m.step(0x14a2, 10); // ld hl,0xa7b1

    m.push16(0x14a5);
    m.step(0x1319, 17); // call 0x1319
    m.call(0x1319);

    regs.hl = 0xa5d1;
    m.step(0x14a8, 10); // ld hl,0xa5d1

    m.push16(0x14ab);
    m.step(0x1319, 17); // call 0x1319 -- returns with DE = 0xFFE0
    m.call(0x1319);

    regs.hl = 0xa610;
    m.step(0x14ae, 10); // ld hl,0xa610

    mem.write8(regs.hl, regs.a);
    m.step(0x14af, 7); // ld (hl),a

    regs.addHl(regs.de);
    m.step(0x14b0, 11); // add hl,de -- HL -= 0x20, one row

    mem.write8(regs.hl, regs.a);
    m.step(0x14b1, 7); // ld (hl),a

    regs.hl = 0xa611;
    m.step(0x14b4, 10); // ld hl,0xa611

    mem.write8(regs.hl, regs.a);
    m.step(0x14b5, 7); // ld (hl),a

    regs.addHl(regs.de);
    m.step(0x14b6, 11); // add hl,de

    mem.write8(regs.hl, regs.a);
    m.step(0x14b7, 7); // ld (hl),a

    regs.hl = 0xa612;
    m.step(0x14ba, 10); // ld hl,0xa612

    mem.write8(regs.hl, regs.a);
    m.step(0x14bb, 7); // ld (hl),a

    regs.addHl(regs.de);
    m.step(0x14bc, 11); // add hl,de

    mem.write8(regs.hl, regs.a);
    m.step(0x14bd, 7); // ld (hl),a
  } else {
    m.step(0x1431, 7); // jr z,0x149d (not taken) -- the drawing pass

    regs.hl = mem.read16(0xa9f7);
    m.step(0x1434, 16); // ld hl,(0xa9f7)

    regs.a = mem.read8(regs.hl);
    m.step(0x1435, 7); // ld a,(hl)

    regs.cp(0xff);
    m.step(0x1437, 7); // cp 0xff

    if (!regs.fNZ) {
      m.step(0x1439, 7); // jr nz,0x144b (not taken) -- end of the script

      regs.a = 0x00;
      m.step(0x143b, 7); // ld a,0x00

      mem.write8(0xa9f2, regs.a);
      m.step(0x143e, 13); // ld (0xa9f2),a

      regs.a = 0x02;
      m.step(0x1440, 7); // ld a,0x02

      mem.write8(0xa9f0, regs.a);
      m.step(0x1443, 13); // ld (0xa9f0),a -- advance to step 2

      regs.hl = mem.read16(0xa9f7);
      m.step(0x1446, 16); // ld hl,(0xa9f7)

      regs.hl = (regs.hl - 1) & 0xffff;
      m.step(0x1447, 6); // dec hl -- no flags

      mem.write16(0xa9f7, regs.hl);
      m.step(0x144a, 16); // ld (0xa9f7),hl

      m.ret(); // 144a  ret
      return;
    }
    m.step(0x144b, 12); // jr nz,0x144b (taken)

    m.push16(0x144e);
    m.step(0x1563, 17); // call 0x1563
    m.call(0x1563);

    regs.hl = mem.read16(0xa9f7);
    m.step(0x1451, 16); // ld hl,(0xa9f7)

    regs.a = mem.read8(regs.hl);
    m.step(0x1452, 7); // ld a,(hl)

    regs.and(0x01);
    m.step(0x1454, 7); // and 0x01

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1455, 6); // inc hl -- no flags

    mem.write16(0xa9f7, regs.hl);
    m.step(0x1458, 16); // ld (0xa9f7),hl -- no flags

    if (regs.fZ) {
      m.step(0x1469, 12); // jr z,0x1469 (taken)
    } else {
      m.step(0x145a, 7); // jr z,0x1469 (not taken)

      regs.de = 0x0020;
      m.step(0x145d, 10); // ld de,0x0020 -- one tilemap row

      regs.hl = 0xa5f0;
      m.step(0x1460, 10); // ld hl,0xa5f0

      regs.incMem8(mem, regs.hl);
      m.step(0x1461, 11); // inc (hl)

      regs.addHl(regs.de);
      m.step(0x1462, 11); // add hl,de

      regs.incMem8(mem, regs.hl);
      m.step(0x1463, 11); // inc (hl)

      regs.hl = 0xa5f2;
      m.step(0x1466, 10); // ld hl,0xa5f2

      regs.incMem8(mem, regs.hl);
      m.step(0x1467, 11); // inc (hl)

      regs.addHl(regs.de);
      m.step(0x1468, 11); // add hl,de

      regs.incMem8(mem, regs.hl);
      m.step(0x1469, 11); // inc (hl)
    }

    regs.hl = mem.read16(0xa9f7);
    m.step(0x146c, 16); // ld hl,(0xa9f7)

    regs.a = mem.read8(regs.hl);
    m.step(0x146d, 7); // ld a,(hl)

    regs.and(0x01);
    m.step(0x146f, 7); // and 0x01

    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1470, 6); // inc hl -- no flags

    mem.write16(0xa9f7, regs.hl);
    m.step(0x1473, 16); // ld (0xa9f7),hl -- no flags

    if (regs.fZ) {
      m.step(0x147e, 12); // jr z,0x147e (taken)
    } else {
      m.step(0x1475, 7); // jr z,0x147e (not taken)

      regs.de = 0x0020;
      m.step(0x1478, 10); // ld de,0x0020

      regs.hl = 0xa5f1;
      m.step(0x147b, 10); // ld hl,0xa5f1

      regs.incMem8(mem, regs.hl);
      m.step(0x147c, 11); // inc (hl)

      regs.addHl(regs.de);
      m.step(0x147d, 11); // add hl,de

      regs.incMem8(mem, regs.hl);
      m.step(0x147e, 11); // inc (hl)
    }

    regs.c = 0x02;
    m.step(0x1480, 7); // ld c,0x02

    regs.de = 0xa5d1;
    m.step(0x1483, 10); // ld de,0xa5d1

    m.push16(0x1486);
    m.step(0x4a9d, 17); // call 0x4a9d
    m.call(0x4a9d);

    regs.hl = mem.read16(0xa9f7);
    m.step(0x1489, 16); // ld hl,(0xa9f7)

    regs.de = 0xfff3;
    m.step(0x148c, 10); // ld de,0xfff3

    regs.addHl(regs.de);
    m.step(0x148d, 11); // add hl,de -- rewind the script pointer by 13

    mem.write16(0xa9f7, regs.hl);
    m.step(0x1490, 16); // ld (0xa9f7),hl

    regs.c = 0x00;
    m.step(0x1492, 7); // ld c,0x00

    regs.de = 0xa631;
    m.step(0x1495, 10); // ld de,0xa631

    m.push16(0x1498);
    m.step(0x4a9d, 17); // call 0x4a9d
    m.call(0x4a9d);

    m.push16(0x149b);
    m.step(0x158c, 17); // call 0x158c
    m.call(0x158c);

    m.step(0x14bd, 12); // jr 0x14bd
  }

  regs.a = mem.read8(0xa9f2);
  m.step(0x14c0, 13); // ld a,(0xa9f2)

  regs.a = regs.dec8(regs.a);
  m.step(0x14c1, 4); // dec a

  mem.write8(0xa9f2, regs.a);
  m.step(0x14c4, 13); // ld (0xa9f2),a

  m.ret(); // 14c4  ret
}
