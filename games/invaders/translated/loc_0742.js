// SPDX-License-Identifier: GPL-3.0-only
// loc_0742  (ROM 0x0742-0x074a) -- points HL at the sprite record 0x2087, calls 0x1a3b, then
// tail-jumps into loc_1a47. Called from loc_073c, loc_0728 (in loc_070c), and loc_0682.
export function loc_0742(m) {
  const { regs } = m;
  regs.hl = 0x2087; m.step(0x0745, 10);                 // 0742 lxi h,0x2087
  m.push16(0x0748); m.step(0x1a3b, 17); m.call(0x1a3b); // 0745 call 0x1a3b
  m.step(0x1a47, 10); return m.call(0x1a47);            // 0748 jmp 0x1a47
}
