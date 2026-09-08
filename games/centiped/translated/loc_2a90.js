// SPDX-License-Identifier: GPL-3.0-only
// loc_2a90  (ROM 0x2a90-0x2a92) -- store A into $64,X, then fall through into loc_2a92.
export function loc_2a90(m) {
  const { regs, mem } = m;
  mem.write8((0x64 + regs.x) & 0xff, regs.a); m.step(0x2a92, 4);       // 2a90 sta $64,x
  return m.call(0x2a92);                                               // fall through into loc_2a92
}
