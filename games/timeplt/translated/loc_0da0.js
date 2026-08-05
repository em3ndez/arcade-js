// SPDX-License-Identifier: GPL-3.0-only

// loc_0da0  (ROM 0x0DA0–0x0DAE)
export function loc_0da0(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);
  m.step(0x0da1, 7); // ld a,(hl)
  regs.rrca();
  m.step(0x0da2, 4); // rrca
  regs.rrca();
  m.step(0x0da3, 4); // rrca
  regs.rrca();
  m.step(0x0da4, 4); // rrca
  regs.rrca();
  m.step(0x0da5, 4); // rrca

  m.push16(0x0da8);
  m.step(0x0daf, 17); // call 0x0daf
  m.call(0x0daf);

  m.push16(0x0da9);
  m.step(0x0020, 11); // rst 0x20 -- DE -= 0x20
  m.call(0x0020);

  regs.a = mem.read8(regs.hl);
  m.step(0x0daa, 7); // ld a,(hl) -- the SAME byte, unrotated

  m.push16(0x0dad);
  m.step(0x0daf, 17); // call 0x0daf
  m.call(0x0daf);

  m.push16(0x0dae);
  m.step(0x0020, 11); // rst 0x20 -- DE -= 0x20
  m.call(0x0020);

  m.ret(); // 0dae
}
