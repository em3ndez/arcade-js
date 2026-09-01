// SPDX-License-Identifier: GPL-3.0-only
// loc_1579  (ROM 0x1579-0x1580) -- reached by `jnc 0x1579` at 0x14f2: set the 0x2085 flag to 1,
// then tail-jump into loc_1545 (delegate; the boundary is not inlined).
export function loc_1579(m) {
  const { regs, mem } = m;

  regs.a = 0x01; m.step(0x157b, 7); // 1579  mvi a,0x01
  mem.write8(0x2085, regs.a); m.step(0x157e, 13); // 157b  sta 0x2085
  m.step(0x1545, 10); return m.call(0x1545); // 157e  jmp 0x1545
}
