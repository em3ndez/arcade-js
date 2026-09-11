// SPDX-License-Identifier: GPL-3.0-only
// loc_9bca (ROM 0x9bca-0x9bcf) -- clears $010a, then rts. A leaf computed-dispatch target.
export function loc_9bca(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9bcc, 2);
  mem.write8(0x010a, regs.a); m.step(0x9bcf, 4);
  return m.ret(6);
}
