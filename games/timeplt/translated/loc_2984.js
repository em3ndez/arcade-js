// SPDX-License-Identifier: GPL-3.0-only

// loc_2984  (ROM 0x2984-0x29AF)
export function loc_2984(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(IX(0x00));
  m.step(0x2987, 19); // ld a,(ix+0x00)
  regs.and(regs.a);
  m.step(0x2988, 4); // and a

  if (regs.fZ) {
    m.ret(11); // ret z taken -- slot idle
    return;
  }
  m.step(0x2989, 5); // ret z not taken

  regs.a = regs.inc8(regs.a);
  m.step(0x298a, 4); // inc a

  if (!regs.fZ) {
    m.step(0x298c, 7); // jr z,0x2993 not taken

    regs.a = regs.inc8(regs.a);
    m.step(0x298d, 4); // inc a

    if (regs.fZ) {
      m.step(0x2b52, 10); // jp z,0x2b52 taken -- TAIL transfer, nothing pushed
      return m.call(0x2b52);
    }
    m.step(0x2990, 10); // jp z not taken

    m.step(0x2b93, 10); // jp 0x2b93 -- TAIL transfer
    return m.call(0x2b93);
  }
  m.step(0x2993, 12); // jr z,0x2993 taken

  regs.a = mem.read8(0xa980);
  m.step(0x2996, 13); // ld a,(0xa980)
  regs.and(0x03);
  m.step(0x2998, 7); // and 0x03
  regs.cp(0x03);
  m.step(0x299a, 7); // cp 0x03 -- carry on 3 frames in 4

  if (regs.fC) {
    m.push16(0x299d);
    m.step(0x2bef, 17); // call c,0x2bef taken
    m.call(0x2bef);
  } else {
    m.step(0x299d, 10); // call c not taken
  }

  m.push16(0x29a0);
  m.step(0x5840, 17); // call 0x5840
  m.call(0x5840);

  m.push16(0x29a3);
  m.step(0x2b83, 17); // call 0x2b83 -- returns a carry, not a value
  m.call(0x2b83);

  if (regs.fC) {
    m.step(0x2bde, 10); // jp c,0x2bde taken -- TAIL transfer, clears the slot
    return m.call(0x2bde);
  }
  m.step(0x29a6, 10); // jp c not taken

  m.push16(0x29a9);
  m.step(0x3ed6, 17); // call 0x3ed6
  m.call(0x3ed6);

  m.push16(0x29ac);
  m.step(0x2a97, 17); // call 0x2a97
  m.call(0x2a97);

  m.push16(0x29af);
  m.step(0x4243, 17); // call 0x4243
  m.call(0x4243);

  m.ret(); // 29af  ret
}
