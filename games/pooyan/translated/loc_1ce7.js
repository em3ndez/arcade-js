// SPDX-License-Identifier: GPL-3.0-only

// loc_1ce7  (ROM 0x1ce7-0x1cf5) -- sprite-slot tail, a mid-routine entry of loc_1c66 (reached by
// fall-through there and by `call nz,0x1ce7` at 0x1d23). Writes 0x02/0x25/0x20 down three cells at
// 0x84e0 / 0x84c0 / 0x84a0 (stride -0x20), then returns.
export function loc_1ce7(m) {
  const { regs, mem } = m;

  regs.hl = 0x84e0;          m.step(0x1cea, 10);
  mem.write8(regs.hl, 0x02); m.step(0x1cec, 10);
  regs.de = 0xffe0;          m.step(0x1cef, 10);
  regs.addHl(regs.de);       m.step(0x1cf0, 11); // -> 0x84c0
  mem.write8(regs.hl, 0x25); m.step(0x1cf2, 10);
  regs.addHl(regs.de);       m.step(0x1cf3, 11); // -> 0x84a0
  mem.write8(regs.hl, 0x20); m.step(0x1cf5, 10);
  m.ret();
}
