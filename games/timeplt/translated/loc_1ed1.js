// SPDX-License-Identifier: GPL-3.0-only

// loc_1ed1  (ROM 0x1ED1–0x1EDE)
export function loc_1ed1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa987);
  m.step(0x1ed4, 13); // ld a,(0xa987)
  regs.and(regs.a);
  m.step(0x1ed5, 4); // and a
  regs.hl = 0xa9af;
  m.step(0x1ed8, 10); // ld hl,0xa9af

  if (regs.fNZ) {
    m.step(0x1edd, 12); // jr nz,0x1edd -- taken
  } else {
    m.step(0x1eda, 7); // jr nz -- not taken
    regs.hl = 0xa9b0;
    m.step(0x1edd, 10); // ld hl,0xa9b0
  }

  regs.a = mem.read8(regs.hl);
  m.step(0x1ede, 7); // ld a,(hl)

  m.ret(10); // ret (0x1EDE)
}
