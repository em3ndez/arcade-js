// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1f83  (ROM 0x1F83–0x1F8C) — (0x1F83): per-slot state check. active (==1) -> loc_1f93; else skip.
 *  the slot's 4 buffer bytes and advance.
 */
export function loc_1f83(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.a = mem.read8(R(0x00));
  m.step(0x1f86, 19); // ld a,(ix+0x00)
  regs.a = regs.dec8(regs.a);
  m.step(0x1f87, 4); // dec a
  if (regs.fZ) { m.step(0x1f93, 10); return m.call(0x1f93); } // jp z -- active slot
  m.step(0x1f8a, 10); // jp z NOT taken
  regs.l = regs.inc8(regs.l);
  m.step(0x1f8b, 4); // inc l
  regs.l = regs.inc8(regs.l);
  m.step(0x1f8c, 4); // inc l
  regs.l = regs.inc8(regs.l);
  m.step(0x1f8d, 4); // inc l (3rd; loc_1f8d is the 4th, below)
  return m.call(0x1f8d);
}
