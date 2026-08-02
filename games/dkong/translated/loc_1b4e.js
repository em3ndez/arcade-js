// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1b4e  (ROM 0x1B4E–0x1B54) — store B,D at (HL+1),(HL+3) then jp into loc_1b45.
 *  Reached from loc_1afe's 0x1B2E jp z; HL is 0x621A there.
 */
export function loc_1b4e(m) {
  const { regs, mem } = m;
  regs.l = regs.inc8(regs.l);
  m.step(0x1b4f, 4); // inc l
  mem.write8(regs.hl, regs.b);
  m.step(0x1b50, 7); // ld (hl),b
  regs.l = regs.inc8(regs.l);
  m.step(0x1b51, 4); // inc l
  mem.write8(regs.hl, regs.d);
  m.step(0x1b52, 7); // ld (hl),d
  m.step(0x1b45, 10); // jp 0x1b45
  return m.call(0x1b45);
}
