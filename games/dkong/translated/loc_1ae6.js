// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1ae6  (ROM 0x1AE6–0x1AF2) — WALK/CLIMB direction pick, gated by 241f's (D,E).
 */
export function loc_1ae6(m, R) {
  const { regs, mem } = m;
  m.push16(0x1ae9);
  m.step(0x241f, 17); // call 0x241f
  m.call(0x241f); // returns (D,E); plain call
  regs.a = mem.read8(0x6010);
  m.step(0x1aec, 13); // ld a,(0x6010)
  regs.e = regs.dec8(regs.e); // E was 241f's E
  m.step(0x1aed, 4); // dec e
  if (regs.fNZ) {
    m.step(0x1af0, 10); // jr nz NOT to loc_1af5
    regs.bit(0, regs.a); // input dir bit 0 (register form)
    m.step(0x1af2, 12); // bit 0,a
    if (regs.fNZ) { m.step(0x1c8f, 10); return m.call(0x1c8f); } // jp nz
  } else {
    m.step(0x1af5, 10);
  }
  return m.call(0x1af5, R);
}
