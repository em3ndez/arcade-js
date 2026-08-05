// SPDX-License-Identifier: GPL-3.0-only

// loc_5303  (ROM 0x5303-0x530D)
export function loc_5303(m) {
  const { regs } = m;

  m.push16(0x5306);
  m.step(0x200c, 17); // call 0x200c
  m.call(0x200c);

  regs.cp(0x67);
  m.step(0x5308, 7); // cp 0x67
  if (regs.fNZ) {
    m.step(0x0f8d, 10); // jp nz,0x0f8d -- tail-jump
    return m.call(0x0f8d);
  }
  m.step(0x530b, 10); // jp nz not taken
  m.step(0x0f1a, 10); // jp 0x0f1a -- tail-jump
  return m.call(0x0f1a);
}
