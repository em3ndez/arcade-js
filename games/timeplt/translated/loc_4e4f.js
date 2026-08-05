// SPDX-License-Identifier: GPL-3.0-only

// loc_4e4f  (ROM 0x4E4F-0x4E62) — delegates into 0x4E63, which owns the rest.
export function loc_4e4f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x4e52, 13); // ld a,(0xad04)
  regs.cp(0x04);
  m.step(0x4e54, 7); // cp 0x04
  if (regs.fZ) {
    m.step(0x4f2a, 10); // jp z,0x4f2a -- TAIL
    return m.call(0x4f2a);
  }
  m.step(0x4e57, 10); // jp z not taken

  regs.a = regs.dec8(regs.a);
  m.step(0x4e58, 4); // dec a
  if (regs.fZ) {
    m.step(0x4ebc, 10); // jp z,0x4ebc -- TAIL
    return m.call(0x4ebc);
  }
  m.step(0x4e5b, 10); // jp z not taken

  regs.a = mem.read8(0xa980);
  m.step(0x4e5e, 13); // ld a,(0xa980)
  regs.and(0x01);
  m.step(0x4e60, 7); // and 0x01
  if (regs.fNZ) {
    m.step(0x4f35, 10); // jp nz,0x4f35 -- TAIL
    return m.call(0x4f35);
  }
  m.step(0x4e63, 10); // jp nz not taken

  return m.call(0x4e63);
}
