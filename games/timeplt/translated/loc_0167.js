// SPDX-License-Identifier: GPL-3.0-only

// loc_0167  (ROM 0x0167-0x0173) — falls through into 0x0174, which owns the body.
export function loc_0167(m) {
  const { regs, mem } = m;

  regs.l = regs.a;
  m.step(0x0168, 4); // ld l,a
  regs.and(mem.read8(regs.hl));
  m.step(0x0169, 7); // and (hl)
  regs.d = regs.inc8(regs.d);
  m.step(0x016a, 4); // inc d
  regs.adc(regs.b);
  m.step(0x016b, 4); // adc a,b
  regs.d = regs.a;
  m.step(0x016c, 4); // ld d,a
  regs.and(regs.l);
  m.step(0x016d, 4); // and l
  regs.cp(regs.a);
  m.step(0x016e, 4); // cp a -- always sets Z
  regs.incMem8(mem, regs.hl);
  m.step(0x016f, 11); // inc (hl)

  m.push16(0x0170);
  m.step(0x0010, 11); // rst 0x10
  m.call(0x0010);

  regs.af = m.pop16();
  m.step(0x0171, 10); // pop af
  regs.sub(mem.read8(regs.hl));
  m.step(0x0172, 7); // sub (hl)
  regs.af = m.pop16();
  m.step(0x0173, 10); // pop af
  regs.cp(regs.c);
  m.step(0x0174, 4); // cp c


  return m.call(0x0174);
}
