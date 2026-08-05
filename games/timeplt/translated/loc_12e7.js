// SPDX-License-Identifier: GPL-3.0-only

// loc_12e7  (ROM 0x12E7-0x12FA, Time Pilot)
export function loc_12e7(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad32);
  m.step(0x12ea, 13); // ld a,(0xad32)
  regs.and(regs.a);
  m.step(0x12eb, 4); // and a -- zero test
  regs.hl = 0xad20;
  m.step(0x12ee, 10); // ld hl,0xad20 -- ld rr,nn sets no flags, the `and a` Z stands
  if (regs.fZ) {
    m.step(0x12f3, 12); // jr z,0x12f3 -- keep 0xad20
  } else {
    m.step(0x12f0, 7); // jr z not taken
    regs.hl = 0xad10;
    m.step(0x12f3, 10); // ld hl,0xad10
  }

  regs.a = mem.read8(regs.hl);
  m.step(0x12f4, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x12f5, 4); // and a
  if (regs.fNZ) {
    m.step(0x1226, 10); // jp nz,0x1226 -- TAIL
    return m.call(0x1226);
  }
  m.step(0x12f8, 10); // jp nz not taken

  m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL, advance the sequence
  return m.call(0x0f1a);
}
