// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_20b5  (ROM 0x20B5–0x20C2) — sets the horizontal velocity sign into (ix+10/11).
 */
export function sub_20b5(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.a = mem.read8(R(0x10));
  m.step(0x20b8, 19); // ld a,(ix+0x10)
  regs.and(regs.a);
  m.step(0x20b9, 4); // and a
  if (regs.fNZ) { m.step(0x20e1, 10); return m.call(0x20e1); } // jp nz
  m.step(0x20bc, 10);
  mem.write8(R(0x11), regs.a); // A = 0
  m.step(0x20bf, 19); // ld (ix+0x11),a
  mem.write8(R(0x10), 0xff);
  m.step(0x20c3, 19); // ld (ix+0x10),0xff
  return m.call(0x20c3);
}
