// SPDX-License-Identifier: GPL-3.0-only

// loc_0f1a  (ROM 0x0F1A-0x0F1E)
export function loc_0f1a(m) {
  const { regs, mem } = m;

  regs.hl = 0xa9ac;
  m.step(0x0f1d, 10); // ld hl,0xa9ac
  regs.incMem8(mem, regs.hl);
  m.step(0x0f1e, 11); // inc (hl)
  m.ret(10); // 0f1e
}
