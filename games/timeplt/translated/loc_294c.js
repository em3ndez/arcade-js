// SPDX-License-Identifier: GPL-3.0-only

// loc_294c  (ROM 0x294C-0x296D, Time Pilot)
export function loc_294c(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x294f, 19); // 294c  ld a,(ix+0x00)
  regs.and(regs.a);
  m.step(0x2950, 4); // 294f  and a

  if (regs.fZ) {
    m.ret(11); // 2950  ret z taken -- the slot is empty
    return;
  }
  m.step(0x2951, 5); // 2950  ret z not taken

  regs.a = regs.inc8(regs.a);
  m.step(0x2952, 4); // 2951  inc a -- Z iff the byte was 0xFF

  if (regs.fZ) {
    m.step(0x295b, 12); // 2952  jr z,0x295b taken
  } else {
    m.step(0x2954, 7); // 2952  jr z not taken

    regs.a = regs.inc8(regs.a);
    m.step(0x2955, 4); // 2954  inc a -- Z iff the byte was 0xFE

    if (regs.fZ) {
      m.step(0x2b52, 10); // 2955  jp z,0x2b52 -- TAIL transfer, nothing pushed
      return m.call(0x2b52);
    }
    m.step(0x2958, 10); // 2955  jp z not taken

    m.step(0x2b93, 10); // 2958  jp 0x2b93 -- TAIL transfer, nothing pushed
    return m.call(0x2b93);
  }

  m.push16(0x295e);
  m.step(0x2bef, 17); // 295b  call 0x2bef
  m.call(0x2bef);

  m.push16(0x2961);
  m.step(0x5854, 17); // 295e  call 0x5854
  m.call(0x5854);

  m.push16(0x2964);
  m.step(0x2b83, 17); // 2961  call 0x2b83
  m.call(0x2b83);

  if (regs.fC) {
    m.step(0x2bde, 10); // 2964  jp c,0x2bde -- TAIL transfer on loc_2b83's carry
    return m.call(0x2bde);
  }
  m.step(0x2967, 10); // 2964  jp c not taken

  m.push16(0x296a);
  m.step(0x3ed6, 17); // 2967  call 0x3ed6
  m.call(0x3ed6);

  m.push16(0x296d);
  m.step(0x2a47, 17); // 296a  call 0x2a47
  m.call(0x2a47);

  m.ret(); // 296d  ret
}
