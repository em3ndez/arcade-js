// SPDX-License-Identifier: GPL-3.0-only

// loc_307f  (ROM 0x307F-0x3089, Time Pilot)
export function loc_307f(m) {
  const { regs, mem } = m;

  mem.write8(regs.hl, regs.e);
  m.step(0x3080, 7); // ld (hl),e
  regs.and(mem.read8(regs.hl));
  m.step(0x3081, 7); // and (hl)

  if (regs.djnz() !== 0) {
    m.step(0x3074, 13); // djnz 0x3074 taken
    return m.call(0x3074);
  }
  m.step(0x3083, 8); // djnz NOT taken

  m.push16(0x3084);
  m.step(0x0010, 11); // rst 0x10 -- word at HL indexed by A -> DE, HL left past it
  m.call(0x0010);

  regs.incMem8(mem, regs.hl);
  m.step(0x3085, 11); // inc (hl)
  regs.and(regs.l);
  m.step(0x3086, 4); // and l
  regs.add(regs.a);
  m.step(0x3087, 4); // add a,a
  regs.cp(regs.a);
  m.step(0x3088, 4); // cp a -- always Z
  regs.af = m.pop16(); // pop af -- NO matching push; two bytes of the caller's stack
  m.step(0x3089, 10); // pop af
  regs.cp(regs.c);
  m.step(0x308a, 4); // cp c

  return m.call(0x308a);
}
