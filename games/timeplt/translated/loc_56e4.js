// SPDX-License-Identifier: GPL-3.0-only

// loc_56e4  (ROM 0x56E4–0x56EF)
export function loc_56e4(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x27cb);
  m.step(0x56e7, 13); // ld a,(0x27cb)
  m.push16(0x56ea);
  m.step(0x5617, 17); // call 0x5617
  m.call(0x5617);

  regs.a = mem.read8(0x33a0);
  m.step(0x56ed, 13); // ld a,(0x33a0)

  m.step(0x5617, 10); // jp 0x5617 -- TAIL transfer
  return m.call(0x5617);
}
