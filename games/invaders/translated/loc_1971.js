// SPDX-License-Identifier: GPL-3.0-only
// loc_1971  (ROM 0x1971-0x1978) -- set the flag at 0x206d to 1 and tail-jump into loc_16e6
// (delegate).
export function loc_1971(m) {
  const { regs, mem } = m;

  regs.a = 0x01; m.step(0x1973, 7); // 1971  mvi a,0x01
  mem.write8(0x206d, regs.a); m.step(0x1976, 13); // 1973  sta 0x206d
  m.step(0x16e6, 10); return m.call(0x16e6); // 1976  jmp 0x16e6
}
