// SPDX-License-Identifier: GPL-3.0-only
// loc_af77  (ROM 0xaf77-0xaf80) -- calls aaf5 (BCD shift routine), then A=0x56... A=0x29/Y=1 and jmp
// $dfb1 (tail-call, block op on $29 length 1).
export function loc_af77(m) {
  const { regs } = m;
  m.push16(0xaf79); m.step(0xaf7a, 6); m.call(0xaaf5);
  regs.a = 0x29; regs.setNZ(regs.a); m.step(0xaf7c, 2);
  regs.y = 0x01; regs.setNZ(regs.y); m.step(0xaf7e, 2);
  m.step(0xdfb1, 3); return m.call(0xdfb1);
}
