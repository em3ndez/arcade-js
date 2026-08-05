// SPDX-License-Identifier: GPL-3.0-only

// loc_52aa  (ROM 0x52AA–0x52D1)
export function loc_52aa(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x08c9);
  m.step(0x52ad, 13); // ld a,(0x08c9)
  mem.write8(0xa98d, regs.a);
  m.step(0x52b0, 13); // ld (0xa98d),a
  regs.a = mem.read8(0x0874);
  m.step(0x52b3, 13); // ld a,(0x0874)
  mem.write8(0xa9cd, regs.a);
  m.step(0x52b6, 13); // ld (0xa9cd),a

  regs.a = mem.read8(0xc360);
  m.step(0x52b9, 13); // ld a,(0xc360) -- DSW0
  regs.cpl();
  m.step(0x52ba, 4); // cpl
  mem.write8(0xa9b1, regs.a);
  m.step(0x52bd, 13); // ld (0xa9b1),a

  m.push16(0x52c0);
  m.step(0x4acc, 17); // call 0x4acc
  m.call(0x4acc);

  regs.a = mem.read8(0xc200);
  m.step(0x52c3, 13); // ld a,(0xc200) -- DSW1
  regs.cpl();
  m.step(0x52c4, 4); // cpl
  regs.c = regs.a;
  m.step(0x52c5, 4); // ld c,a
  regs.and(0x03);
  m.step(0x52c7, 7); // and 0x03
  regs.add(0x03);
  m.step(0x52c9, 7); // add a,0x03
  regs.cp(0x06);
  m.step(0x52cb, 7); // cp 0x06

  if (regs.fNZ) {
    m.step(0x52cf, 12); // jr nz,0x52cf
  } else {
    m.step(0x52cd, 7); // jr nz -- not taken
    regs.a = 0xff;
    m.step(0x52cf, 7); // ld a,0xff
  }

  m.step(0x2e19, 10); // jp 0x2e19
  return m.call(0x2e19); // tail jump -- no return address pushed
}
