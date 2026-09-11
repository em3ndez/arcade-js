// SPDX-License-Identifier: GPL-3.0-only
// loc_aa62  (ROM 0xaa62-0xaa6e) -- a=0x30,x=0, call loc_ab17 then loc_aa92, then tail-jmp loc_a8e7.
export function loc_aa62(m) {
  const { regs, mem } = m;
  regs.a = 0x30; regs.setNZ(regs.a); m.step(0xaa64, 2);
  regs.x = 0x00; regs.setNZ(regs.x); m.step(0xaa66, 2);
  m.push16(0xaa68); m.step(0xaa69, 6); m.call(0xab17);
  m.push16(0xaa6b); m.step(0xaa6c, 6); m.call(0xaa92);
  m.step(0xa8e7, 3); return m.call(0xa8e7);
}
