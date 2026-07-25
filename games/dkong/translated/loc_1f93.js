// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1f93  (ROM 0x1F93–0x1FA9) — active-slot dispatch on (ix+1)/(ix+2). All targets are exx branches.
 */
export function loc_1f93(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.a = mem.read8(R(0x01));
  m.step(0x1f96, 19); // ld a,(ix+0x01)
  regs.a = regs.dec8(regs.a);
  m.step(0x1f97, 4); // dec a
  if (regs.fZ) { m.step(0x20ec, 10); return m.call(0x20ec); } // jp z -- exx @0x20EC
  m.step(0x1f9a, 10);
  regs.a = mem.read8(R(0x02));
  m.step(0x1f9d, 19); // ld a,(ix+0x02)
  regs.rra(); // bit 0 -> carry
  m.step(0x1f9e, 4); // rra
  if (regs.fC) { m.step(0x1fac, 10); return m.call(0x1fac); } // jp c -- exx @0x1FAC
  m.step(0x1fa1, 10);
  regs.rra(); // bit 1
  m.step(0x1fa2, 4); // rra
  if (regs.fC) { m.step(0x1fe5, 10); return m.call(0x1fe5); } // jp c -- exx @0x1FE5
  m.step(0x1fa5, 10);
  regs.rra(); // bit 2
  m.step(0x1fa6, 4); // rra
  if (regs.fC) { m.step(0x1fef, 10); return m.call(0x1fef); } // jp c -- exx @0x1FEF
  m.step(0x1fa9, 10);
  m.step(0x2053, 10); // jp 0x2053 -- exx @0x2053
  return m.call(0x2053);
}
