// SPDX-License-Identifier: GPL-3.0-only

// loc_1323  (ROM 0x1323-0x1366, Time Pilot)
export function loc_1323(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa980);
  m.step(0x1326, 13); // ld a,(0xa980)

  regs.and(0x02);
  m.step(0x1328, 7); // and 0x02

  if (regs.fNZ) {
    m.ret(11); // 1328  ret nz (taken)
    return;
  }
  m.step(0x1329, 5); // ret nz (not taken)

  regs.a = mem.read8(0xa9f0);
  m.step(0x132c, 13); // ld a,(0xa9f0)

  regs.and(regs.a);
  m.step(0x132d, 4); // and a

  if (!regs.fNZ) {
    m.step(0x132f, 7); // jr nz,0x1333 (not taken)
    m.push16(0x1332);
    m.step(0x1367, 17); // call 0x1367
    m.call(0x1367);
    m.ret(); // 1332  ret
    return;
  }
  m.step(0x1333, 12); // jr nz,0x1333 (taken)

  regs.a = regs.dec8(regs.a);
  m.step(0x1334, 4); // dec a

  if (!regs.fNZ) {
    m.step(0x1336, 7); // jr nz,0x133d (not taken)
    m.push16(0x1339);
    m.step(0x1367, 17); // call 0x1367
    m.call(0x1367);
    m.push16(0x133c);
    m.step(0x142a, 17); // call 0x142a
    m.call(0x142a);
    m.ret(); // 133c  ret
    return;
  }
  m.step(0x133d, 12); // jr nz,0x133d (taken)

  regs.a = regs.dec8(regs.a);
  m.step(0x133e, 4); // dec a

  if (!regs.fNZ) {
    m.step(0x1340, 7); // jr nz,0x1347 (not taken)
    m.push16(0x1343);
    m.step(0x1393, 17); // call 0x1393
    m.call(0x1393);
    m.push16(0x1346);
    m.step(0x14c5, 17); // call 0x14c5
    m.call(0x14c5);
    m.ret(); // 1346  ret
    return;
  }
  m.step(0x1347, 12); // jr nz,0x1347 (taken)

  regs.a = regs.dec8(regs.a);
  m.step(0x1348, 4); // dec a

  if (!regs.fNZ) {
    m.step(0x134a, 7); // jr nz,0x134e (not taken)
    m.push16(0x134d);
    m.step(0x14c5, 17); // call 0x14c5
    m.call(0x14c5);
    m.ret(); // 134d  ret
    return;
  }
  m.step(0x134e, 12); // jr nz,0x134e (taken)

  regs.a = regs.dec8(regs.a);
  m.step(0x134f, 4); // dec a

  if (!regs.fNZ) {
    m.step(0x1351, 7); // jr nz,0x1355 (not taken)
    m.push16(0x1354);
    m.step(0x13cc, 17); // call 0x13cc
    m.call(0x13cc);
    m.ret(); // 1354  ret
    return;
  }
  m.step(0x1355, 12); // jr nz,0x1355 (taken)

  regs.a = 0x5a;
  m.step(0x1357, 7); // ld a,0x5a

  mem.write8(0xa9eb, regs.a);
  m.step(0x135a, 13); // ld (0xa9eb),a

  m.push16(0x135d);
  m.step(0x15b6, 17); // call 0x15b6
  m.call(0x15b6);

  m.push16(0x1360);
  m.step(0x4c75, 17); // call 0x4c75
  m.call(0x4c75);

  regs.a = mem.read8(0x2750); // a ROM byte: 0x03
  m.step(0x1363, 13); // ld a,(0x2750)

  mem.write8(0xa9ac, regs.a);
  m.step(0x1366, 13); // ld (0xa9ac),a

  m.ret(); // 1366  ret
}
