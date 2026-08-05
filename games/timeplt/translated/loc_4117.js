// SPDX-License-Identifier: GPL-3.0-only

// loc_4117  (ROM 0x4117–0x413B)
export function loc_4117(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  m.push16(regs.bc);
  m.step(0x4118, 11); // push bc
  regs.a = mem.read8(0xa980); // frame counter
  m.step(0x411b, 13); // ld a,(0xa980)
  regs.and(0x0f);
  m.step(0x411d, 7); // and 0x0f
  regs.cp(mem.read8(R(0x0f)));
  m.step(0x4120, 19); // cp (ix+0x0f)

  if (regs.fNZ) {
    m.step(0x412b, 12); // jr nz,0x412b (taken) -- not this object's phase
  } else {
    m.step(0x4122, 7); // jr nz,0x412b (not taken)
    regs.hl = 0xac7f;
    m.step(0x4125, 10); // ld hl,0xac7f
    m.push16(0x4128);
    m.step(0x33b8, 17); // call 0x33b8 -- returns a byte in A
    m.call(0x33b8);
    mem.write8(R(0x01), regs.a);
    m.step(0x412b, 19); // ld (ix+0x01),a
  }

  m.push16(0x412e);
  m.step(0x4201, 17); // call 0x4201
  m.call(0x4201);

  m.push16(0x4131);
  m.step(0x58aa, 17); // call 0x58aa
  m.call(0x58aa);

  m.push16(0x4134);
  m.step(0x3faf, 17); // call 0x3faf
  m.call(0x3faf);

  regs.bc = m.pop16(); // balances the push at 0x4117
  m.step(0x4135, 10); // pop bc

  m.push16(0x4138);
  m.step(0x2b83, 17); // call 0x2b83 -- verdict comes back in CARRY
  m.call(0x2b83);

  if (regs.fNC) {
    m.ret(11); // ret nc (taken)
    return;
  }
  m.step(0x4139, 5); // ret nc (not taken)

  m.step(0x40ab, 10);
  return m.call(0x40ab);
}
