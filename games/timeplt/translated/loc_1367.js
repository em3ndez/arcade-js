// SPDX-License-Identifier: GPL-3.0-only

// loc_1367  (ROM 0x1367-0x1392, Time Pilot)
export function loc_1367(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9f1);
  m.step(0x136a, 13); // ld a,(0xa9f1)

  regs.cp(0x08);
  m.step(0x136c, 7); // cp 0x08

  if (regs.fNZ) {
    m.step(0x1376, 12); // jr nz,0x1376 (taken)
  } else {
    m.step(0x136e, 7); // jr nz,0x1376 (not taken)

    regs.a = 0x01;
    m.step(0x1370, 7); // ld a,0x01

    mem.write8(0xa9f0, regs.a);
    m.step(0x1373, 13); // ld (0xa9f0),a -- advance to step 1

    m.push16(0x1376);
    m.step(0x5811, 17); // call 0x5811
    m.call(0x5811);
  }

  regs.a = mem.read8(0xa9f1);
  m.step(0x1379, 13); // ld a,(0xa9f1)

  regs.and(0x01);
  m.step(0x137b, 7); // and 0x01 -- Z when the tick count is even

  regs.a = 0x3e;
  m.step(0x137d, 7); // ld a,0x3e -- sets no flags

  if (regs.fZ) {
    m.step(0x1381, 12); // jr z,0x1381 (taken) -- even tick, keep 0x3E
  } else {
    m.step(0x137f, 7); // jr z,0x1381 (not taken)
    regs.a = 0x00;
    m.step(0x1381, 7); // ld a,0x00 -- odd tick
  }

  regs.b = regs.a;
  m.step(0x1382, 4); // ld b,a

  regs.a = mem.read8(0xaa40);
  m.step(0x1385, 13); // ld a,(0xaa40)

  regs.and(0xc0);
  m.step(0x1387, 7); // and 0xc0 -- keep bits 6 and 7

  regs.add(regs.b);
  m.step(0x1388, 4); // add a,b

  mem.write8(0xaa40, regs.a);
  m.step(0x138b, 13); // ld (0xaa40),a

  regs.a = mem.read8(0xa9f1);
  m.step(0x138e, 13); // ld a,(0xa9f1)

  regs.a = regs.inc8(regs.a);
  m.step(0x138f, 4); // inc a

  mem.write8(0xa9f1, regs.a);
  m.step(0x1392, 13); // ld (0xa9f1),a

  m.ret(); // 1392  ret
}
