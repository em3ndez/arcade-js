// SPDX-License-Identifier: GPL-3.0-only
// loc_18df  (ROM 0x18df-0x18e6) -- set the mode/state byte 0x20cf to 0x08, then tail-jmp to
// loc_0aea. Reached both by fall-through from loc_18d4 and by `jmp 0x18df` at 0x0be5.
export function loc_18df(m) {
  const { regs, mem } = m;

  regs.a = 0x08; m.step(0x18e1, 7); // 18df  mvi a,0x08
  mem.write8(0x20cf, regs.a); m.step(0x18e4, 13); // 18e1  sta 0x20cf
  m.step(0x0aea, 10); return m.call(0x0aea); // 18e4  jmp 0x0aea
}
