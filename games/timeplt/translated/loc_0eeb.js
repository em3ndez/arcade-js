// SPDX-License-Identifier: GPL-3.0-only

// loc_0eeb  (ROM 0x0eeb-0x0f05, Time Pilot)
export function loc_0eeb(m) {
  const { regs, mem } = m;

  regs.and(0x0f);
  m.step(0x0eed, 7); // 0eeb  and 0x0f

  if (regs.fZ) {
    m.step(0x0eff, 12); // 0eed  jr z,0x0eff (taken)

    regs.a = regs.b;
    m.step(0x0f00, 4); // 0eff  ld a,b
    regs.and(regs.a);
    m.step(0x0f01, 4); // 0f00  and a

    if (regs.fNZ) {
      m.step(0x0f03, 7); // 0f01  jr z,0x0ef1 (not taken)
      regs.b = regs.dec8(regs.b);
      m.step(0x0f04, 4); // 0f03  dec b
      m.push16(0x0f05);
      m.step(0x0028, 11); // 0f04  rst 0x28 -- DE += 0x20
      m.call(0x0028);
      m.ret(); // 0f05  ret
      return;
    }
    m.step(0x0ef1, 12); // 0f01  jr z,0x0ef1 (taken)
  } else {
    m.step(0x0eef, 7); // 0eed  jr z,0x0eff (not taken)
    regs.b = 0x00;
    m.step(0x0ef1, 7); // 0eef  ld b,0x00
  }

  m.push16(regs.hl);
  m.step(0x0ef2, 11); // 0ef1  push hl
  regs.hl = 0x0f06;
  m.step(0x0ef5, 10); // 0ef2  ld hl,0x0f06
  m.push16(0x0ef6);
  m.step(0x0008, 11); // 0ef5  rst 0x08 -- A = (0x0f06 + A); HL left at that byte
  m.call(0x0008);
  regs.hl = m.pop16();
  m.step(0x0ef7, 10); // 0ef6  pop hl
  mem.write8(regs.de, regs.a, 4);
  m.step(0x0ef8, 7); // 0ef7  ld (de),a
  regs.d = regs.res(2, regs.d);
  m.step(0x0efa, 8); // 0ef8  res 2,d
  regs.a = regs.c;
  m.step(0x0efb, 4); // 0efa  ld a,c
  mem.write8(regs.de, regs.a, 4);
  m.step(0x0efc, 7); // 0efb  ld (de),a
  regs.d = regs.set(2, regs.d);
  m.step(0x0efe, 8); // 0efc  set 2,d

  m.ret(); // 0efe  ret
}
