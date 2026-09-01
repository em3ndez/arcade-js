// SPDX-License-Identifier: GPL-3.0-only
// loc_0707  (ROM 0x0707-0x070b) -- reached by `jz 0x0707` at 0x1809. Sets B=0xfe then
// tail-jumps to loc_19dc, delegating rather than inlining across the boundary.
export function loc_0707(m) {
  const { regs } = m;

  regs.b = 0xfe; m.step(0x0709, 7);          // 0707  mvi b,0xfe
  m.step(0x19dc, 10); return m.call(0x19dc); // 0709  jmp 0x19dc
}
