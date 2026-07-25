// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_20a2  (ROM 0x20A2–0x20C2) — state-1 -- proximity check (ix+15)/(0x6205).
 */
export function sub_20a2(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.a = mem.read8(R(0x15));
  m.step(0x20a5, 19); // ld a,(ix+0x15)
  regs.and(regs.a);
  m.step(0x20a6, 4); // and a
  if (regs.fNZ) { m.step(0x20b5, 10); return m.call(0x20b5); } // jp nz
  m.step(0x20a9, 10);
  regs.hl = 0x6205;
  m.step(0x20ac, 10); // ld hl,0x6205
  regs.a = mem.read8(R(0x05));
  m.step(0x20af, 19); // ld a,(ix+0x05)
  regs.sub(0x16);
  m.step(0x20b1, 7); // sub 0x16
  regs.cp(mem.read8(regs.hl));
  m.step(0x20b2, 7); // cp (hl)
  if (regs.fNC) { m.step(0x20c3, 10); return m.call(0x20c3); } // jp nc
  m.step(0x20b5, 5);
  return m.call(0x20b5);
}
