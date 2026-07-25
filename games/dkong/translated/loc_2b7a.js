// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2b7a  (ROM 0x2B7A–0x2B88) — shared tail: adjust X by (0x6210) parity, store to (0x6203)/(0x694c); pop hl/ret SKIP.
 */
export function loc_2b7a(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6210);
  m.step(0x2b7d, 13); // ld a,(0x6210)
  regs.and(regs.a); // sets Z from (0x6210) -- read by the jp z below
  m.step(0x2b7e, 4); // and a
  regs.a = mem.read8(0x6203); // ld a,(0x6203) -- does NOT touch flags
  m.step(0x2b81, 13);
  if (regs.fZ) { m.step(0x2b8b, 10); return m.call(0x2b8b); } // jp z,0x2b8b ((0x6210)==0)
  m.step(0x2b84, 10);
  regs.or(0x07);
  m.step(0x2b86, 7); // or 0x07
  regs.sub(0x04);
  m.step(0x2b88, 7); // sub 0x04
  m.step(0x2b91, 10); // jp 0x2b91
  return m.call(0x2b91);
}
