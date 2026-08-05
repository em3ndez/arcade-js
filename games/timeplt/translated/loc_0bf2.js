// SPDX-License-Identifier: GPL-3.0-only

// loc_0bf2  (ROM 0x0BF2-0x0BFE) — falls through into 0x0BFF, which owns the shared body.
export function loc_0bf2(m) {
  const { regs, mem } = m;

  regs.hl = 0x0c50;
  m.step(0x0bf5, 10); // ld hl,0x0c50
  m.push16(0x0bf8);
  m.step(0x018c, 17); // call 0x018c
  m.call(0x018c);

  { const t = regs.de; regs.de = regs.hl; regs.hl = t; }
  m.step(0x0bf9, 4); // ex de,hl
  regs.e = mem.read8(regs.hl);
  m.step(0x0bfa, 7); // ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0bfb, 6); // inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x0bfc, 7); // ld d,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0bfd, 6); // inc hl
  regs.c = mem.read8(regs.hl);
  m.step(0x0bfe, 7); // ld c,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0bff, 6); // inc hl

  return m.call(0x0bff);
}
