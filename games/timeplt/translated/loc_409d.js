// SPDX-License-Identifier: GPL-3.0-only

// loc_409d  (ROM 0x409D-0x40AA, Time Pilot)
export function loc_409d(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x00) & 0xffff, 0x3b);
  m.step(0x40a1, 19); // ld (ix+0x00),0x3b

  regs.a = mem.read8(0xad04);
  m.step(0x40a4, 13); // ld a,(0xad04)
  regs.and(regs.a);
  m.step(0x40a5, 4); // and a

  if (regs.fZ) {
    m.step(0x568e, 10); // jp z,0x568e taken -- TAIL jump, nothing pushed
    return m.call(0x568e);
  }
  m.step(0x40a8, 10); // jp z not taken -- same destination, 10 T-states later

  m.step(0x568e, 10); // jp 0x568e -- TAIL jump, nothing pushed
  return m.call(0x568e);
}
