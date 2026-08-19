// SPDX-License-Identifier: GPL-3.0-only

// loc_0020  (ROM 0x0020-0x0027) -- rst 0x20 table-index helper: HL += A (16-bit, via add/adc),
// then A = (HL), ret. Callers set HL = table base, A = byte index (see loc_0092's coinage lookups).
export function loc_0020(m) {
  const { regs, mem } = m;

  regs.add(regs.l);
  m.step(0x0021, 4); // 0020  add a,l
  regs.l = regs.a;
  m.step(0x0022, 4); // 0021  ld l,a
  regs.a = 0x00;
  m.step(0x0024, 7); // 0022  ld a,0x00
  regs.adc(regs.h);
  m.step(0x0025, 4); // 0024  adc a,h
  regs.h = regs.a;
  m.step(0x0026, 4); // 0025  ld h,a
  regs.a = mem.read8(regs.hl);
  m.step(0x0027, 7); // 0026  ld a,(hl)

  m.ret(); // 0027  ret
}
