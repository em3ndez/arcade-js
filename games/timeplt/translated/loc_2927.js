// SPDX-License-Identifier: GPL-3.0-only

// loc_2927  (ROM 0x2927-0x294B)
export function loc_2927(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x292a, 19); // ld a,(ix+0x00)
  regs.and(regs.a);
  m.step(0x292b, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z -- the slot is empty
    return;
  }
  m.step(0x292c, 5); // ret z not taken

  regs.a = regs.inc8(regs.a);
  m.step(0x292d, 4); // inc a -- Z iff the byte was 0xFF
  if (regs.fZ) {
    m.step(0x2936, 12); // jr z,0x2936 taken
  } else {
    m.step(0x292f, 7); // jr z not taken
    regs.a = regs.inc8(regs.a);
    m.step(0x2930, 4); // inc a -- Z iff the byte was 0xFE
    if (regs.fZ) {
      m.step(0x2b52, 10); // jp z,0x2b52 -- tail-jump
      return m.call(0x2b52);
    }
    m.step(0x2933, 10); // jp z not taken
    m.step(0x2b93, 10); // jp 0x2b93 -- tail-jump
    return m.call(0x2b93);
  }

  m.push16(0x2939);
  m.step(0x2bef, 17); // call 0x2bef
  m.call(0x2bef);

  m.push16(0x293c);
  m.step(0x5840, 17); // call 0x5840
  m.call(0x5840);

  m.push16(0x293f);
  m.step(0x2b83, 17); // call 0x2b83
  m.call(0x2b83);

  if (regs.fC) {
    m.step(0x2bde, 10); // jp c,0x2bde -- tail-jump on 0x2b83's carry
    return m.call(0x2bde);
  }
  m.step(0x2942, 10); // jp c not taken

  m.push16(0x2945);
  m.step(0x3ed6, 17); // call 0x3ed6
  m.call(0x3ed6);

  m.push16(0x2948);
  m.step(0x2a3c, 17); // call 0x2a3c
  m.call(0x2a3c);

  m.push16(0x294b);
  m.step(0x4243, 17); // call 0x4243
  m.call(0x4243);

  m.ret(10); // 294b
}
