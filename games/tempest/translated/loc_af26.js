// SPDX-License-Identifier: GPL-3.0-only
// loc_af26  (ROM 0xaf26-0xaf3e) -- if $0600|$0601 == 0 tail to the shared rts at $af6e; else draw
// slot 0 (jsr $af3f) and fall through into loc_af3f for slot 1 (x=1).
export function loc_af26(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0600); regs.setNZ(regs.a); m.step(0xaf29, 4);
  regs.ora(mem.read8(0x0601)); m.step(0xaf2c, 4);
  if (regs.fZ) { m.step(0xaf6e, 3); return m.call(0xaf6e); }
  m.step(0xaf2e, 2);
  regs.x = 0x12; regs.setNZ(regs.x); m.step(0xaf30, 2);
  m.push16(0xaf32); m.step(0xaf33, 6); m.call(0xab14);
  regs.a = 0x63; regs.setNZ(regs.a); m.step(0xaf35, 2);
  m.push16(0xaf37); m.step(0xaf38, 6); m.call(0xaf71);
  regs.x = 0x00; regs.setNZ(regs.x); m.step(0xaf3a, 2);
  m.push16(0xaf3c); m.step(0xaf3d, 6); m.call(0xaf3f);
  regs.x = 0x01; regs.setNZ(regs.x); m.step(0xaf3f, 2);
  return m.call(0xaf3f);
}
