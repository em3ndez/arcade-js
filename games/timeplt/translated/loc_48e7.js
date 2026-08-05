// SPDX-License-Identifier: GPL-3.0-only

// loc_48e7  (ROM 0x48E7-0x48FF, Time Pilot)
export function loc_48e7(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9ae);
  m.step(0x48ea, 13); // ld a,(0xa9ae)
  regs.rrca();
  m.step(0x48eb, 4); // rrca -- carry = bit 0
  regs.rrca();
  m.step(0x48ec, 4); // rrca -- carry = bit 1
  regs.rrca();
  m.step(0x48ed, 4); // rrca -- carry = bit 2
  regs.hl = 0xa983;
  m.step(0x48f0, 10); // ld hl,0xa983
  mem.write8(regs.hl, regs.rl(mem.read8(regs.hl)));
  m.step(0x48f2, 15); // rl (hl) -- shift that carry in at the bottom
  regs.a = mem.read8(regs.hl);
  m.step(0x48f3, 7); // ld a,(hl)
  regs.and(0x07);
  m.step(0x48f5, 7); // and 0x07
  regs.cp(0x01);
  m.step(0x48f7, 7); // cp 0x01
  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- pattern not matched
    return;
  }
  m.step(0x48f8, 5); // ret nz NOT taken

  m.push16(0x48fb);
  m.step(0x57f1, 17); // call 0x57f1
  m.call(0x57f1);

  regs.c = 0x01;
  m.step(0x48fd, 7); // ld c,0x01

  m.step(0x496e, 10); // jp 0x496e -- tail-jump; its ret returns to OUR caller
  return m.call(0x496e);
}
