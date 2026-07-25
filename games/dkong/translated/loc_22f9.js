// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_22f9  (ROM 0x22F9–0x2302) — store the velocity pair: (ix+0x11)=A; (ix+0x10)=(A&1)-1 (0x00 odd/0xFF even).
 */
export function loc_22f9(m) {
  const { regs, mem } = m;
  mem.write8((regs.ix + 0x11) & 0xffff, regs.a); // ld (ix+0x11),a -- magnitude/value
  m.step(0x22fc, 19);
  regs.and(0x01); // isolate bit 0
  m.step(0x22fe, 7);
  regs.a = regs.dec8(regs.a); // dec a -- 0x00 (bit0 set) or 0xFF (clear) = direction sign
  m.step(0x22ff, 4);
  mem.write8((regs.ix + 0x10) & 0xffff, regs.a); // ld (ix+0x10),a
  m.step(0x2302, 19);
  m.ret(10); // ret (0x2302)
}
