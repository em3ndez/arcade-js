// SPDX-License-Identifier: GPL-3.0-only

// loc_5c75  (ROM 0x5c75-0x5c7f) -- found-handler helper: store DE into (iy+0x0c:0x0d) and clear
// (iy+0x0e); ret. Pure leaf, no calls.
export function loc_5c75(m) {
  const { regs, mem } = m;

  mem.write8((regs.iy + 0x0c) & 0xffff, regs.e);  m.step(0x5c78, 19);
  mem.write8((regs.iy + 0x0d) & 0xffff, regs.d);  m.step(0x5c7b, 19);
  mem.write8((regs.iy + 0x0e) & 0xffff, 0x00);    m.step(0x5c7f, 19);
  return m.ret(10); // 5c7f  ret
}
