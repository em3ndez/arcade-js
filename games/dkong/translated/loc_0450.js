// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0450  (ROM 0x0450–0x0460) — (0x6227) bit dispatch: bit0==0 -> loc_0478; bit1 -> loc_0486; else rst 0x38 sprite.
 */
export function loc_0450(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6227);
  m.step(0x0453, 13); // ld a,(0x6227)
  regs.rrca();
  m.step(0x0454, 4); // rrca -- C = (6227) bit0
  if (regs.fNC) { m.step(0x0478, 10); return m.call(0x0478); } // jp nc,0x0478
  m.step(0x0457, 10); // bit0==1
  regs.rrca();
  m.step(0x0458, 4); // rrca -- C = (6227) bit1
  if (regs.fC) { m.step(0x0486, 10); return m.call(0x0486); } // jp c,0x0486
  m.step(0x045b, 10); // bit1==0
  regs.hl = 0x690b;
  m.step(0x045e, 10); // ld hl,0x690b
  regs.c = 0xfc;
  m.step(0x0460, 7); // ld c,0xfc (-4)
  m.push16(0x0461); m.step(0x0038, 11); m.call(0x0038); // rst 0x38 = CALL loc_0038
  m.step(0x0486, 10); // jp 0x0486
  return m.call(0x0486);
}
