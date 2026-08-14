// SPDX-License-Identifier: GPL-3.0-only

// loc_269a  (ROM 0x269A-0x26A5) — clear the 4-byte timer/counter block at 0x805C-0x805F to 0.
export function loc_269a(m) {
  const { regs, mem } = m;

  regs.hl = 0x805c;
  m.step(0x269d, 10);
  regs.xor(regs.a);
  m.step(0x269e, 4); // A = 0
  mem.write8(regs.hl, regs.a);
  m.step(0x269f, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x26a0, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x26a1, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x26a2, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x26a3, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x26a4, 6);
  mem.write8(regs.hl, regs.a);
  m.step(0x26a5, 7);
  m.ret(10);
}
