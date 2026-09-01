// SPDX-License-Identifier: GPL-3.0-only
// loc_154a  (ROM 0x154a-0x1552) -- clear the prize-active flag 0x2002, load B=0xf7, then tail-jump
// into loc_19dc. A shared tail reached by fall-through (loc_1545) and by `jmp 0x154a` (loc_1530).
export function loc_154a(m) {
  const { regs, mem } = m;

  regs.xor(regs.a); m.step(0x154b, 4); // 154a  xra a
  mem.write8(0x2002, regs.a); m.step(0x154e, 13); // 154b  sta 0x2002
  regs.b = 0xf7; m.step(0x1550, 7); // 154e  mvi b,0xf7
  m.step(0x19dc, 10); return m.call(0x19dc); // 1550  jmp 0x19dc
}
