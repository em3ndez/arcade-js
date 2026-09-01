// SPDX-License-Identifier: GPL-3.0-only
// loc_1474  (ROM 0x1474-0x147b) -- select shift-register offset from L&7 (OUT port 2), then tail
// -jump into loc_1a47. Delegates across the boundary rather than inlining.
export function loc_1474(m) {
  const { regs } = m;

  regs.a = regs.l; m.step(0x1475, 5); // 1474  mov a,l
  regs.and(0x07); m.step(0x1477, 7); // 1475  ani 0x07
  m.io.portOut(0x02, regs.a); m.step(0x1479, 10); // 1477  out 0x02
  m.step(0x1a47, 10); return m.call(0x1a47); // 1479  jmp 0x1a47
}
