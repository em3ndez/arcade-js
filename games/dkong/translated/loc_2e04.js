// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2e04  (ROM 0x2E04–0x2ED3) — per-object actor/animation updater.
 * rst 0x30 / rst 0x10 skip gates (A=0x04), then scan 10 objects: IX=0x6500 stride 0x10,
 * IY=0x6980 stride 0x04. Per object: bit0 of (ix+0) active? Every-16-frame toggle (iy+1)^=7;
 * state 4 -> loc_2e84 (rise/deactivate); else advance (ix+3)+=2, walk the 0x39xx string via
 * (ix+0e/0f) (0x7F -> loc_2e9c reset), accumulate into (ix+5); at the 0xB7 boundary + a
 * terminator, set state 4 + sound; mirror (ix+3)/(ix+5) to IY. Inactive -> loc_2ea7 spawns
 * on (0x6396) bit0. Uses add iy,de (addIy).
 */
export function loc_2e04(m) {
  const { regs } = m;
  regs.a = 0x04;
  m.step(0x2e06, 7); // ld a,0x04
  m.push16(0x2e07); m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // skip gate
  m.push16(0x2e08); m.step(0x0010, 11); // rst 0x10
  if (!m.call(0x0010)) return; // skip gate
  regs.ix = 0x6500;
  m.step(0x2e0c, 14); // ld ix,0x6500
  regs.iy = 0x6980;
  m.step(0x2e10, 14); // ld iy,0x6980
  regs.b = 0x0a;
  m.step(0x2e12, 7); // ld b,0x0a
  do {
    m.call(0x2e12); // one object -- ends at loc_2e78's add iy,de (0x2E81 = the djnz)
    regs.djnz();
    m.step(regs.b !== 0 ? 0x2e12 : 0x2e83, regs.b !== 0 ? 13 : 8); // djnz 0x2e12
  } while (regs.b !== 0);
  m.ret(); // 0x2E83
}
