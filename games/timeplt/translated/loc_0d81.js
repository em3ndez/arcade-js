// SPDX-License-Identifier: GPL-3.0-only

// loc_0d81  (ROM 0x0D81–0x0D8F)
export function loc_0d81(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);
  m.step(0x0d82, 7); // ld a,(hl)
  regs.rrca();
  m.step(0x0d83, 4); // rrca
  regs.rrca();
  m.step(0x0d84, 4); // rrca
  regs.rrca();
  m.step(0x0d85, 4); // rrca
  regs.rrca();
  m.step(0x0d86, 4); // rrca

  m.push16(0x0d89);
  m.step(0x0d90, 17); // call 0x0d90
  m.call(0x0d90);

  m.push16(0x0d8a);
  m.step(0x0020, 11); // rst 0x20 -- DE -= 0x20
  m.call(0x0020);

  regs.a = mem.read8(regs.hl);
  m.step(0x0d8b, 7); // ld a,(hl)

  m.push16(0x0d8e);
  m.step(0x0d90, 17); // call 0x0d90
  m.call(0x0d90);

  m.push16(0x0d8f);
  m.step(0x0020, 11); // rst 0x20 -- DE -= 0x20
  m.call(0x0020);

  m.ret(10); // ret (0x0D8F)
}
