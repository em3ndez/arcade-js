// SPDX-License-Identifier: GPL-3.0-only
// loc_9b98  (ROM 0x9b98-0x9ba1) -- RTS-trick jump table: Y=A indexes a table of (target-1) words at 0x9ba2
// (lo) / 0x9ba3 (hi); pushes it and RTS dispatches to word+1. Target resolved at runtime from mem.
export function loc_9b98(m) {
  const { regs, mem } = m;
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x9b99, 2);
  regs.a = mem.read8((0x9ba3 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x9b9c, 4);
  m.push8(regs.a); m.step(0x9b9d, 3);
  regs.a = mem.read8((0x9ba2 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x9ba0, 4);
  m.push8(regs.a); m.step(0x9ba1, 3);
  const target = (m.pull16() + 1) & 0xffff;                                              // 9ba1 rts -- pull pushed word +1
  m.step(target, 6);
  return m.call(target);
}
