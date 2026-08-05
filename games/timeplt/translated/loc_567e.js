// SPDX-License-Identifier: GPL-3.0-only

// loc_567e  (ROM 0x567E–0x5682)
export function loc_567e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x3270);
  m.step(0x5681, 13); // ld a,(0x3270)
  m.step(0x5617, 12); // jr 0x5617 -- TAIL jump, nothing pushed
  return m.call(0x5617);
}
