// SPDX-License-Identifier: GPL-3.0-only

// loc_29d5  (ROM 0x29D5-0x29F6)
export function loc_29d5(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(IX(0x00));
  m.step(0x29d8, 19); // ld a,(ix+0x00)
  regs.and(regs.a);
  m.step(0x29d9, 4); // and a

  if (regs.fZ) {
    m.ret(11); // ret z taken -- slot idle
    return;
  }
  m.step(0x29da, 5); // ret z not taken

  regs.a = regs.inc8(regs.a);
  m.step(0x29db, 4); // inc a

  if (!regs.fZ) {
    m.step(0x29dd, 7); // jr z,0x29e4 not taken

    regs.a = regs.inc8(regs.a);
    m.step(0x29de, 4); // inc a

    if (regs.fZ) {
      m.step(0x2b52, 10); // jp z,0x2b52 taken -- TAIL transfer, nothing pushed
      return m.call(0x2b52);
    }
    m.step(0x29e1, 10); // jp z not taken

    m.step(0x2b93, 10); // jp 0x2b93 -- TAIL transfer
    return m.call(0x2b93);
  }
  m.step(0x29e4, 12); // jr z,0x29e4 taken

  m.push16(0x29e7);
  m.step(0x29f7, 17); // call 0x29f7
  m.call(0x29f7);

  m.push16(0x29ea);
  m.step(0x2b83, 17); // call 0x2b83 -- returns a carry, not a value
  m.call(0x2b83);

  if (regs.fC) {
    m.step(0x2bde, 10); // jp c,0x2bde taken -- TAIL transfer, clears the slot
    return m.call(0x2bde);
  }
  m.step(0x29ed, 10); // jp c not taken

  m.push16(0x29f0);
  m.step(0x2b38, 17); // call 0x2b38
  m.call(0x2b38);

  m.push16(0x29f3);
  m.step(0x3ed6, 17); // call 0x3ed6
  m.call(0x3ed6);

  m.push16(0x29f6);
  m.step(0x4243, 17); // call 0x4243
  m.call(0x4243);

  m.ret(); // 29f6  ret
}
