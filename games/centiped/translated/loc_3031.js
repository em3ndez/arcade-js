// SPDX-License-Identifier: GPL-3.0-only
// loc_3031  (ROM 0x3031-0x3037) -- decrements the object index X; on underflow exits to loc_3049, else loops via loc_2f4f.
export function loc_3031(m) {
  const { regs } = m;
  regs.x = regs.dec8(regs.x); m.step(0x3032, 2);                    // 3031 dex
  if (regs.fN) { m.step(0x3049, 3); return m.call(0x3049); }        // 3032 bmi $3049
  m.step(0x3034, 2);
  m.step(0x2f4f, 3); return m.call(0x2f4f);                         // 3034 jmp $2f4f
}
