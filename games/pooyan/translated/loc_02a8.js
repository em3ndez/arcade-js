// SPDX-License-Identifier: GPL-3.0-only

// loc_02a8  (ROM 0x02a8-0x02a9) -- write tile 0x01 at (hl), then fall through into
// loc_02aa (its own entry), which writes the next two tiles DE apart and rets. Entered
// via `call 0x02a8` (loc_0254 @ 0x027a); the ret in loc_02aa returns to that caller.
export function loc_02a8(m) {
  const { regs, mem } = m;

  mem.write8(regs.hl, 0x01);
  m.step(0x02aa, 10); // 02a8  ld (hl),0x01
  return m.call(0x02aa); // fall through into loc_02aa
}
