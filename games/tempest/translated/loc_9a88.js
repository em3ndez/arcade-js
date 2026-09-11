// SPDX-License-Identifier: GPL-3.0-only
// loc_9a88  (ROM 0x9a88-0x9a92) -- RTS-trick jump table: Y=2*A indexes a table of (target-1) words at
// 0x9a93 (lo) / 0x9a94 (hi); pushes it and RTS dispatches to word+1. Target resolved at runtime from mem.
export function loc_9a88(m) {
  const { regs, mem } = m;
  regs.a = regs.asl(regs.a); m.step(0x9a89, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0x9a8a, 2);
  regs.a = mem.read8((0x9a94 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x9a8d, 4);
  m.push8(regs.a); m.step(0x9a8e, 3);
  regs.a = mem.read8((0x9a93 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x9a91, 4);
  m.push8(regs.a); m.step(0x9a92, 3);
  const target = (m.pull16() + 1) & 0xffff;                                              // 9a92 rts -- pull pushed word +1
  m.step(target, 6);
  return m.call(target);
}
