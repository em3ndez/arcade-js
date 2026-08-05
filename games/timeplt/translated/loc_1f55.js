// SPDX-License-Identifier: GPL-3.0-only

// loc_1f55  (ROM 0x1F55-0x1F67, Time Pilot)
export function loc_1f55(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x1f56, 4); // xor a -- A = 0 and carry cleared
  regs.h = regs.a;
  m.step(0x1f57, 4); // ld h,a
  regs.l = regs.a;
  m.step(0x1f58, 4); // ld l,a -- HL = 0
  regs.sbcHl(regs.de);
  m.step(0x1f5a, 15); // sbc hl,de -- HL = -DE
  mem.write8(0xa808, regs.l);
  mem.write8(0xa809, regs.h);
  m.step(0x1f5d, 16); // ld (0xa808),hl

  regs.xor(regs.a);
  m.step(0x1f5e, 4); // xor a -- clears the carry sbc hl,de just set
  regs.h = regs.a;
  m.step(0x1f5f, 4); // ld h,a
  regs.l = regs.a;
  m.step(0x1f60, 4); // ld l,a -- HL = 0
  regs.sbcHl(regs.bc);
  m.step(0x1f62, 15); // sbc hl,bc -- HL = -BC
  mem.write8(0xa80a, regs.l);
  mem.write8(0xa80b, regs.h);
  m.step(0x1f65, 16); // ld (0xa80a),hl

  m.step(0x20af, 10); // jp 0x20af -- TAIL, its ret goes to our caller
  return m.call(0x20af);
}
