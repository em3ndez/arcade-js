// SPDX-License-Identifier: GPL-3.0-only

// loc_1c53  (ROM 0x1c53-0x1c65) -- per-frame object driver, split on frame parity (0x8907 bit0):
// even frames run loc_64e2, odd frames run loc_68f8; both then rebuild the sprite list via loc_02ef.
export function loc_1c53(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907);   m.step(0x1c56, 13);
  regs.and(0x01);               m.step(0x1c58, 7);
  if (regs.fNZ) {
    m.step(0x1c5f, 12);         // jr nz taken -- odd frame
    m.push16(0x1c62); m.step(0x68f8, 17); m.call(0x68f8);
  } else {
    m.step(0x1c5a, 7);          // jr nz not taken -- even frame
    m.push16(0x1c5d); m.step(0x64e2, 17); m.call(0x64e2);
    m.step(0x1c62, 12);         // jr 0x1c62
  }
  m.push16(0x1c65); m.step(0x02ef, 17); m.call(0x02ef);
  return m.ret(10);
}
