// SPDX-License-Identifier: GPL-3.0-only
// loc_067e  (ROM 0x067e-0x0681) -- entered by `jmp 0x067e` at 0x050b. Stores HL to 0x2048 and rets.
export function loc_067e(m) {
  const { regs, mem } = m;

  mem.write16(0x2048, regs.hl); m.step(0x0681, 16);     // 067e  shld 0x2048
  return m.ret(10);                                     // 0681  ret
}
