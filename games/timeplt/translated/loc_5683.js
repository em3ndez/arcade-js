// SPDX-License-Identifier: GPL-3.0-only

// loc_5683  (ROM 0x5683–0x568D)
export function loc_5683(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x07a6);
  m.step(0x5686, 13); // ld a,(0x07a6)

  m.push16(0x5689);
  m.step(0x5617, 17); // call 0x5617
  m.call(0x5617);

  regs.a = mem.read8(0x4cda);
  m.step(0x568c, 13); // ld a,(0x4cda)
  m.step(0x5617, 12); // jr 0x5617 -- TAIL jump, nothing pushed
  return m.call(0x5617);
}
