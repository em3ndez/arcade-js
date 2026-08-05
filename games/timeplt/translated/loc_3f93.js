// SPDX-License-Identifier: GPL-3.0-only

// loc_3f93  (ROM 0x3F93-0x3F9D)
export function loc_3f93(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x3f96, 13); // ld a,(0xad04)
  regs.cp(0x03);
  m.step(0x3f98, 7); // cp 0x03
  if (regs.fC) {
    m.step(0x565f, 10); // jp c,0x565f -- tail-jump
    return m.call(0x565f);
  }
  m.step(0x3f9b, 10); // jp c not taken
  m.step(0x5669, 10); // jp 0x5669 -- tail-jump
  return m.call(0x5669);
}
