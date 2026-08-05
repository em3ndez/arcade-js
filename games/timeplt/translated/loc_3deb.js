// SPDX-License-Identifier: GPL-3.0-only

// loc_3deb  (ROM 0x3DEB-0x3DFA, Time Pilot)
export function loc_3deb(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x3dee, 19); // ld a,(ix+0x00) -- the state byte

  regs.and(regs.a);
  m.step(0x3def, 4); // and a -- zero test

  if (regs.fZ) {
    m.ret(11); // ret z taken -- slot unused
    return;
  }
  m.step(0x3df0, 5); // ret z not taken

  regs.a = regs.inc8(regs.a);
  m.step(0x3df1, 4); // inc a -- Z only if the state was 0xFF

  if (regs.fNZ) {
    m.step(0x3dfb, 10);
    return m.call(0x3dfb);
  }
  m.step(0x3df4, 10); // jp nz not taken (jp costs 10 either way)

  m.push16(0x3df7);
  m.step(0x3e05, 17); // call 0x3e05
  m.call(0x3e05);

  m.push16(0x3dfa);
  m.step(0x2b83, 17); // call 0x2b83
  m.call(0x2b83);

  if (regs.fNC) {
    m.ret(11); // ret nc taken -- 0x2b83 returned no carry
    return;
  }
  m.step(0x3dfb, 5); // ret nc not taken -- fall through into 0x3dfb

  return m.call(0x3dfb);
}
