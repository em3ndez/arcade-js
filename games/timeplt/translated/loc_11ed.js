// SPDX-License-Identifier: GPL-3.0-only

// loc_11ed  (ROM 0x11ED-0x123A, Time Pilot)
export function loc_11ed(m) {
  const { regs, mem } = m;

  m.push16(0x11f0);
  m.step(0x15b6, 17); // call 0x15b6
  m.call(0x15b6);

  regs.a = mem.read8(0xacc6);
  m.step(0x11f3, 13); // ld a,(0xacc6)
  regs.and(regs.a);
  m.step(0x11f4, 4); // and a
  if (regs.fNZ) {
    m.push16(0x11f7);
    m.step(0x2db8, 17); // call nz,0x2db8 taken
    m.call(0x2db8);
  } else {
    m.step(0x11f7, 10); // call nz not taken
  }

  m.push16(0x11fa);
  m.step(0x5634, 17); // call 0x5634
  m.call(0x5634);

  regs.hl = 0xad00;
  m.step(0x11fd, 10); // ld hl,0xad00
  regs.decMem8(mem, regs.hl);
  m.step(0x11fe, 11); // dec (hl)
  m.push16(regs.af); // push af -- carries the dec's Z past the ldir
  m.step(0x11ff, 11);
  regs.a = mem.read8(0xad32);
  m.step(0x1202, 13); // ld a,(0xad32)
  regs.and(regs.a);
  m.step(0x1203, 4); // and a
  regs.de = 0xad10;
  m.step(0x1206, 10); // ld de,0xad10
  if (regs.fZ) {
    m.step(0x120b, 12); // jr z,0x120b -- keep 0xad10
  } else {
    m.step(0x1208, 7); // jr z not taken
    regs.de = 0xad20;
    m.step(0x120b, 10); // ld de,0xad20
  }

  regs.hl = 0xad00;
  m.step(0x120e, 10); // ld hl,0xad00
  regs.bc = 0x0010;
  m.step(0x1211, 10); // ld bc,0x0010
  m.ldirAt(0x1211, 0x1213); // ldir

  regs.af = m.pop16(); // pop af -- restores the `dec (hl)` flags
  m.step(0x1214, 10);
  if (regs.fZ) {
    m.step(0x1253, 12); // jr z,0x1253 -- TAIL
    return m.call(0x1253);
  }
  m.step(0x1216, 7); // jr z not taken

  regs.a = mem.read8(0xad32);
  m.step(0x1219, 13); // ld a,(0xad32)
  regs.and(regs.a);
  m.step(0x121a, 4); // and a
  regs.hl = 0xad20;
  m.step(0x121d, 10); // ld hl,0xad20 -- ld rr,nn sets no flags, the `and a` Z stands
  if (regs.fZ) {
    m.step(0x1222, 12); // jr z,0x1222 -- keep 0xad20
  } else {
    m.step(0x121f, 7); // jr z not taken
    regs.hl = 0xad10;
    m.step(0x1222, 10); // ld hl,0xad10
  }

  regs.a = mem.read8(regs.hl);
  m.step(0x1223, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x1224, 4); // and a
  if (regs.fZ) {
    m.step(0x122f, 12); // jr z,0x122f
  } else {
    m.step(0x1226, 7); // jr z not taken

    regs.a = mem.read8(0xad32);
    m.step(0x1229, 13); // ld a,(0xad32)
    regs.a = regs.inc8(regs.a);
    m.step(0x122a, 4); // inc a
    regs.and(0x01);
    m.step(0x122c, 7); // and 0x01
    mem.write8(0xad32, regs.a);
    m.step(0x122f, 13); // ld (0xad32),a
  }

  regs.a = 0x5a;
  m.step(0x1231, 7); // ld a,0x5a
  mem.write8(0xa9eb, regs.a);
  m.step(0x1234, 13); // ld (0xa9eb),a
  regs.a = mem.read8(0x4b52); // ROM byte
  m.step(0x1237, 13); // ld a,(0x4b52)
  mem.write8(0xa9ac, regs.a);
  m.step(0x123a, 13); // ld (0xa9ac),a

  m.ret(); // 0x123a
}
