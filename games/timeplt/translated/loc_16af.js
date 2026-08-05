// SPDX-License-Identifier: GPL-3.0-only

// loc_16af  (ROM 0x16AF-0x1718)
export function loc_16af(m) {
  const { regs, mem } = m;

  regs.b = 0x00;
  m.step(0x16b1, 7); // 16af  ld b,0x00 -- 256 iterations
  regs.hl = 0x4d9f;
  m.step(0x16b4, 10); // 16b1  ld hl,0x4d9f
  regs.a = mem.read8(0xa9ab);
  m.step(0x16b7, 13); // 16b4  ld a,(0xa9ab)

  do {
    regs.sub(mem.read8(regs.hl));
    m.step(0x16b8, 7); // 16b7  sub (hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x16b9, 6); // 16b8  inc hl
    regs.djnz(); // no flags
    m.step(regs.b !== 0 ? 0x16b7 : 0x16bb, regs.b !== 0 ? 13 : 8); // 16b9  djnz 0x16b7
  } while (regs.b !== 0);

  regs.xor(0xa2);
  m.step(0x16bd, 7); // 16bb  xor 0xa2
  mem.write8(0xa9ab, regs.a);
  m.step(0x16c0, 13); // 16bd  ld (0xa9ab),a

  m.push16(0x16c3);
  m.step(0x0f97, 17); // 16c0  call 0x0f97
  m.call(0x0f97);

  m.push16(0x16c6);
  m.step(0x1edf, 17); // 16c3  call 0x1edf
  m.call(0x1edf);

  m.push16(0x16c9);
  m.step(0x0f97, 17); // 16c6  call 0x0f97 -- the same routine again
  m.call(0x0f97);

  m.push16(0x16cc);
  m.step(0x2cbc, 17); // 16c9  call 0x2cbc
  m.call(0x2cbc);

  m.push16(0x16cf);
  m.step(0x1098, 17); // 16cc  call 0x1098
  m.call(0x1098);

  regs.a = mem.read8(0xa980);
  m.step(0x16d2, 13); // 16cf  ld a,(0xa980)
  regs.and(0x01);
  m.step(0x16d4, 7); // 16d2  and 0x01

  let toF2 = regs.fZ;
  if (toF2) {
    m.step(0x16f2, 12); // 16d4  jr z,0x16f2 (taken)
  } else {
    m.step(0x16d6, 7); // 16d4  jr z,0x16f2 (not taken)
    regs.hl = 0xa9eb;
    m.step(0x16d9, 10); // 16d6  ld hl,0xa9eb
    regs.decMem8(mem, regs.hl);
    m.step(0x16da, 11); // 16d9  dec (hl)
    if (regs.fNZ) {
      m.step(0x16f2, 12); // 16da  jr nz,0x16f2 (taken)
      toF2 = true;
    } else {
      m.step(0x16dc, 7); // 16da  jr nz,0x16f2 (not taken)
    }
  }

  if (!toF2) {
    regs.de = 0x0309;
    m.step(0x16df, 10); // 16dc  ld de,0x0309

    m.push16(0x16e0);
    m.step(0x0038, 11); // 16df  rst 0x38
    m.call(0x0038);

    regs.e = 0x0e;
    m.step(0x16e2, 7); // 16e0  ld e,0x0e -- D is still 0x03

    m.push16(0x16e3);
    m.step(0x0038, 11); // 16e2  rst 0x38
    m.call(0x0038);

    regs.e = 0x1a;
    m.step(0x16e5, 7); // 16e3  ld e,0x1a

    m.push16(0x16e6);
    m.step(0x0038, 11); // 16e5  rst 0x38
    m.call(0x0038);

    regs.xor(regs.a);
    m.step(0x16e7, 4); // 16e6  xor a
    mem.write8(0xad0e, regs.a);
    m.step(0x16ea, 13); // 16e7  ld (0xad0e),a
    regs.a = 0x2a;
    m.step(0x16ec, 7); // 16ea  ld a,0x2a
    mem.write8(0xa9eb, regs.a);
    m.step(0x16ef, 13); // 16ec  ld (0xa9eb),a

    m.step(0x0f1a, 10); // 16ef  jp 0x0f1a -- TAIL jump, nothing pushed
    return m.call(0x0f1a);
  }

  regs.a = mem.read8(0xad0e);
  m.step(0x16f5, 13); // 16f2  ld a,(0xad0e)
  regs.and(regs.a);
  m.step(0x16f6, 4); // 16f5  and a
  if (regs.fZ) {
    m.ret(11); // 16f6  ret z (taken)
    return;
  }
  m.step(0x16f7, 5); // 16f6  ret z (not taken)

  regs.a = mem.read8(0xa980);
  m.step(0x16fa, 13); // 16f7  ld a,(0xa980)
  regs.and(0x0f);
  m.step(0x16fc, 7); // 16fa  and 0x0f

  if (regs.fZ) {
    m.step(0x1707, 12); // 16fc  jr z,0x1707 (taken)
    regs.d = 0x02;
    m.step(0x1709, 7); // 1707  ld d,0x02
    m.step(0x1711, 12); // 1709  jr 0x1711
  } else {
    m.step(0x16fe, 7); // 16fc  jr z,0x1707 (not taken)
    regs.cp(0x05);
    m.step(0x1700, 7); // 16fe  cp 0x05
    if (regs.fZ) {
      m.step(0x170b, 12); // 1700  jr z,0x170b (taken)
      regs.d = 0x0a;
      m.step(0x170d, 7); // 170b  ld d,0x0a
      m.step(0x1711, 12); // 170d  jr 0x1711
    } else {
      m.step(0x1702, 7); // 1700  jr z,0x170b (not taken)
      regs.cp(0x0a);
      m.step(0x1704, 7); // 1702  cp 0x0a
      if (regs.fZ) {
        m.step(0x170f, 12); // 1704  jr z,0x170f (taken)
        regs.d = 0x0b;
        m.step(0x1711, 7); // 170f  ld d,0x0b -- falls into 0x1711
      } else {
        m.step(0x1706, 7); // 1704  jr z,0x170f (not taken)
        m.ret(10); // 1706  ret
        return;
      }
    }
  }

  regs.a = mem.read8(0xad04);
  m.step(0x1714, 13); // 1711  ld a,(0xad04)
  regs.add(0x1a);
  m.step(0x1716, 7); // 1714  add a,0x1a
  regs.e = regs.a;
  m.step(0x1717, 4); // 1716  ld e,a

  m.push16(0x1718);
  m.step(0x0038, 11); // 1717  rst 0x38
  m.call(0x0038);

  m.ret(10); // 1718  ret
}
