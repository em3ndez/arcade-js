// SPDX-License-Identifier: GPL-3.0-only

// loc_29b0  (ROM 0x29B0-0x29D4)
export function loc_29b0(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(IX(0x00));
  m.step(0x29b3, 19); // ld a,(ix+0x00)
  regs.and(regs.a);
  m.step(0x29b4, 4); // and a

  if (regs.fZ) {
    m.ret(11); // ret z taken -- slot idle
    return;
  }
  m.step(0x29b5, 5); // ret z not taken

  regs.a = regs.inc8(regs.a);
  m.step(0x29b6, 4); // inc a

  if (!regs.fZ) {
    m.step(0x29b8, 7); // jr z,0x29bf not taken

    regs.a = regs.inc8(regs.a);
    m.step(0x29b9, 4); // inc a

    if (regs.fZ) {
      m.step(0x2b52, 10); // jp z,0x2b52 taken -- TAIL transfer, nothing pushed
      return m.call(0x2b52);
    }
    m.step(0x29bc, 10); // jp z not taken

    m.step(0x2b93, 10); // jp 0x2b93 -- TAIL transfer
    return m.call(0x2b93);
  }
  m.step(0x29bf, 12); // jr z,0x29bf taken

  m.push16(0x29c2);
  m.step(0x2bef, 17); // call 0x2bef
  m.call(0x2bef);

  m.push16(0x29c5);
  m.step(0x58a4, 17); // call 0x58a4
  m.call(0x58a4);

  m.push16(0x29c8);
  m.step(0x2b83, 17); // call 0x2b83 -- returns a carry, not a value
  m.call(0x2b83);

  if (regs.fC) {
    m.step(0x2bde, 10); // jp c,0x2bde taken -- TAIL transfer, clears the slot
    return m.call(0x2bde);
  }
  m.step(0x29cb, 10); // jp c not taken

  m.push16(0x29ce);
  m.step(0x3ed6, 17); // call 0x3ed6
  m.call(0x3ed6);

  m.push16(0x29d1);
  m.step(0x2afc, 17); // call 0x2afc
  m.call(0x2afc);

  m.push16(0x29d4);
  m.step(0x4243, 17); // call 0x4243
  m.call(0x4243);

  m.ret(); // 29d4  ret
}
