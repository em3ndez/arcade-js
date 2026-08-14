// SPDX-License-Identifier: GPL-3.0-only

// loc_27cb  (ROM 0x27CB-0x27DD) — write a 4-byte collision block at 0x8040 (B, 0x19, 0x03, 0x10) and
// set (0x8340)=0xA0. loc_27de (0x27DE-0x27E9) is the sibling that zeroes the same 0x8040-0x8043 block.
export function loc_27cb(m) {
  const { regs, mem } = m;

  regs.hl = 0x8040;
  m.step(0x27ce, 10); // ld hl,0x8040
  mem.write8(regs.hl, regs.b);
  m.step(0x27cf, 7); // ld (hl),b
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x27d0, 6);
  mem.write8(regs.hl, 0x19);
  m.step(0x27d2, 10); // ld (hl),0x19
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x27d3, 6);
  mem.write8(regs.hl, 0x03);
  m.step(0x27d5, 10); // ld (hl),0x03
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x27d6, 6);
  mem.write8(regs.hl, 0x10);
  m.step(0x27d8, 10); // ld (hl),0x10
  regs.a = 0xa0;
  m.step(0x27da, 7);
  mem.write8(0x8340, regs.a);
  m.step(0x27dd, 13); // ld (0x8340),0xA0
  m.ret();
}

export function loc_27de(m) {
  const { regs, mem } = m;

  regs.hl = 0x8040;
  m.step(0x27e1, 10); // ld hl,0x8040
  regs.xor(regs.a);
  m.step(0x27e2, 4); // xor a
  mem.write8(regs.hl, regs.a);
  m.step(0x27e3, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x27e4, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x27e5, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x27e6, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x27e7, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x27e8, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x27e9, 7); // 0x8040-0x8043 = 0
  m.ret();
}
