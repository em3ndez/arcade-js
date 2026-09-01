// SPDX-License-Identifier: GPL-3.0-only
// loc_00d7  (ROM 0x00d7-0x00e1) -- seed 0x21fb/0x22fb with 0x02, then tail-jump into 0x08e4.
export function loc_00d7(m) {
  const { regs, mem } = m;

  regs.a = 0x02; m.step(0x00d9, 7); // 00d7  mvi a,0x02
  mem.write8(0x21fb, regs.a); m.step(0x00dc, 13); // 00d9  sta 0x21fb
  mem.write8(0x22fb, regs.a); m.step(0x00df, 13); // 00dc  sta 0x22fb
  m.step(0x08e4, 10); return m.call(0x08e4); // 00df  jmp 0x08e4
}
