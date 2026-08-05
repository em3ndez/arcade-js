// SPDX-License-Identifier: GPL-3.0-only

// loc_1393  (ROM 0x1393-0x13CB, Time Pilot)
export function loc_1393(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9f3);
  m.step(0x1396, 13); // ld a,(0xa9f3)

  regs.and(regs.a);
  m.step(0x1397, 4); // and a

  if (regs.fNZ) {
    m.step(0x13a2, 12); // jr nz,0x13a2 (taken)

    regs.and(0x04);
    m.step(0x13a4, 7); // and 0x04

    if (regs.fNZ) {
      m.step(0x13aa, 12); // jr nz,0x13aa (taken) -- A is 0x04 here

      regs.a = regs.dec8(regs.a);
      m.step(0x13ab, 4); // dec a

      if (regs.fNZ) {
        m.step(0x13b1, 12); // jr nz,0x13b1 (taken)

        regs.a = regs.dec8(regs.a);
        m.step(0x13b2, 4); // dec a

        if (regs.fNZ) {
          m.step(0x13b8, 12); // jr nz,0x13b8 (taken)
          regs.a = 0x37;
          m.step(0x13ba, 7); // ld a,0x37
        } else {
          m.step(0x13b4, 7); // jr nz,0x13b8 (not taken) -- unreachable: A is 3 here, so dec a is 2
          regs.a = 0x3e;
          m.step(0x13b6, 7); // ld a,0x3e
          m.step(0x13ba, 12); // jr 0x13ba
        }
      } else {
        m.step(0x13ad, 7); // jr nz,0x13b1 (not taken) -- unreachable: A is 0x04 here, so dec a is 3
        regs.a = 0x36;
        m.step(0x13af, 7); // ld a,0x36
        m.step(0x13ba, 12); // jr 0x13ba
      }
    } else {
      m.step(0x13a6, 7); // jr nz,0x13aa (not taken) -- bit 2 clear
      regs.a = 0x3f;
      m.step(0x13a8, 7); // ld a,0x3f
      m.step(0x13ba, 12); // jr 0x13ba
    }
  } else {
    m.step(0x1399, 7); // jr nz,0x13a2 (not taken) -- the counter is already zero

    regs.a = 0x03;
    m.step(0x139b, 7); // ld a,0x03

    mem.write8(0xa9f0, regs.a);
    m.step(0x139e, 13); // ld (0xa9f0),a -- advance to step 3

    regs.a = 0x3f;
    m.step(0x13a0, 7); // ld a,0x3f
    m.step(0x13ba, 12); // jr 0x13ba
  }

  regs.b = regs.a;
  m.step(0x13bb, 4); // ld b,a

  regs.a = mem.read8(0xaa40);
  m.step(0x13be, 13); // ld a,(0xaa40)

  regs.and(0xc0);
  m.step(0x13c0, 7); // and 0xc0 -- keep bits 6 and 7

  regs.add(regs.b);
  m.step(0x13c1, 4); // add a,b

  mem.write8(0xaa40, regs.a);
  m.step(0x13c4, 13); // ld (0xaa40),a

  regs.a = mem.read8(0xa9f3);
  m.step(0x13c7, 13); // ld a,(0xa9f3)

  regs.a = regs.dec8(regs.a);
  m.step(0x13c8, 4); // dec a

  mem.write8(0xa9f3, regs.a);
  m.step(0x13cb, 13); // ld (0xa9f3),a

  m.ret(); // 13cb  ret
}
