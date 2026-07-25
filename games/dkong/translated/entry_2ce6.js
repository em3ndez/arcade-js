// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_2ce6  (ROM 0x2CE6–0x2D14) — / entry_2cf6 -- slot-field init.; flows into loc_2d15.
 * HL/IX live-in. entry_2ce6: (hl) >= 4 -> entry_2cf6; else clear 0x69A8 + (hl)*4.
 * entry_2cf6: (ix+7/8/15) default (0x15,0x0B,0x00), then (0x19,0x0C,0x01) if (0x6382)
 * bit7 set (rlca -> carry); flows into loc_2d15.
 */
export function entry_2ce6(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(regs.hl);
  m.step(0x2ce7, 7); // ld a,(hl)
  regs.cp(0x04);
  m.step(0x2ce9, 7); // cp 0x04
  if (regs.fNC) { m.step(0x2cf6, 10); return m.call(0x2cf6); } // jp nc,0x2cf6
  m.step(0x2cec, 10);
  regs.hl = 0x69a8;
  m.step(0x2cef, 10); // ld hl,0x69a8
  regs.add(regs.a);
  m.step(0x2cf0, 4); // add a,a (*2)
  regs.add(regs.a);
  m.step(0x2cf1, 4); // add a,a (*4)
  regs.e = regs.a;
  m.step(0x2cf2, 4); // ld e,a
  regs.d = 0x00;
  m.step(0x2cf4, 7); // ld d,0x00
  regs.addHl(regs.de);
  m.step(0x2cf5, 11); // add hl,de -- HL = 0x69A8 + (hl)*4
  mem.write8(regs.hl, regs.d);
  m.step(0x2cf6, 7); // ld (hl),d -- (hl) = 0 (D == 0)
  return m.call(0x2cf6);
}
