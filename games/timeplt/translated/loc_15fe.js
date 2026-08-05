// SPDX-License-Identifier: GPL-3.0-only

// loc_15fe  (ROM 0x15FE-0x163E)
export function loc_15fe(m) {
  const { regs, mem } = m;

  m.push16(0x1601);
  m.step(0x01c2, 17); // call 0x01c2
  m.call(0x01c2);

  if (regs.fNZ) {
    m.ret(11); // ret nz taken
    return;
  }
  m.step(0x1602, 5); // ret nz NOT taken

  regs.de = 0x0105;
  m.step(0x1605, 10); // ld de,0x0105

  m.push16(0x1606);
  m.step(0x0038, 11); // rst 0x38 -- enqueue 0x0105
  m.call(0x0038);

  regs.e = regs.inc8(regs.e);
  m.step(0x1607, 4); // inc e

  m.push16(0x1608);
  m.step(0x0038, 11); // rst 0x38 -- enqueue 0x0106
  m.call(0x0038);

  regs.e = regs.inc8(regs.e);
  m.step(0x1609, 4); // inc e

  m.push16(0x160a);
  m.step(0x0038, 11); // rst 0x38 -- enqueue 0x0107
  m.call(0x0038);

  regs.de = 0x0601;
  m.step(0x160d, 10); // ld de,0x0601

  m.push16(0x160e);
  m.step(0x0038, 11); // rst 0x38 -- enqueue 0x0601
  m.call(0x0038);

  regs.a = 0x13;
  m.step(0x1610, 7); // ld a,0x13
  mem.write8(0xa701, regs.a);
  m.step(0x1613, 13); // ld (0xa701),a
  mem.write8(0xa6e1, regs.a);
  m.step(0x1616, 13); // ld (0xa6e1),a
  regs.hl = 0x163f;
  m.step(0x1619, 10); // ld hl,0x163f -- the six-record patch list
  regs.b = 0x06;
  m.step(0x161b, 7); // ld b,0x06

  for (;;) {
    regs.e = mem.read8(regs.hl);
    m.step(0x161c, 7); // ld e,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x161d, 6); // inc hl
    regs.d = mem.read8(regs.hl);
    m.step(0x161e, 7); // ld d,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x161f, 6); // inc hl
    regs.a = mem.read8(regs.hl);
    m.step(0x1620, 7); // ld a,(hl)
    mem.write8(regs.de, regs.a);
    m.step(0x1621, 7); // ld (de),a
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x1622, 6); // inc de
    regs.exDeHl();
    m.step(0x1623, 4); // ex de,hl
    mem.write8(regs.hl, 0x05);
    m.step(0x1625, 10); // ld (hl),0x05 -- dest+1
    regs.exDeHl();
    m.step(0x1626, 4); // ex de,hl -- HL is the record cursor again
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x1627, 6); // inc hl
    if (regs.djnz() !== 0) {
      m.step(0x161b, 13); // djnz 0x161b taken
      continue;
    }
    m.step(0x1629, 8); // djnz NOT taken
    break;
  }

  m.push16(0x162c);
  m.step(0x0d6b, 17); // call 0x0d6b
  m.call(0x0d6b);

  regs.a = 0x01;
  m.step(0x162e, 7); // ld a,0x01
  mem.write8(0xa9ab, regs.a);
  m.step(0x1631, 13); // ld (0xa9ab),a -- the loc_00d8 sub-state
  regs.a = regs.inc8(regs.a);
  m.step(0x1632, 4); // inc a
  mem.write8(0xa9ac, regs.a);
  m.step(0x1635, 13); // ld (0xa9ac),a -- the loc_15c2 sub-state
  regs.a = mem.read8(0xa9c0);
  m.step(0x1638, 13); // ld a,(0xa9c0)
  regs.and(regs.a);
  m.step(0x1639, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z taken
    return;
  }
  m.step(0x163a, 5); // ret z NOT taken

  regs.de = 0x010d;
  m.step(0x163d, 10); // ld de,0x010d

  m.push16(0x163e);
  m.step(0x0038, 11); // rst 0x38 -- enqueue 0x010d
  m.call(0x0038);

  m.ret(10); // ret
}
