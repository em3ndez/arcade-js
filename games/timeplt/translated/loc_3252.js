// SPDX-License-Identifier: GPL-3.0-only

// loc_3252  (ROM 0x3252-0x326B, Time Pilot)
export function loc_3252(m) {
  const { regs, mem } = m;

  regs.bc = 0x0300;
  m.step(0x3255, 10); // ld bc,0x0300
  regs.hl = 0x0008;
  m.step(0x3258, 10); // ld hl,0x0008
  regs.e = 0x00;
  m.step(0x325a, 7); // ld e,0x00

  for (;;) {
    regs.a = regs.e;
    m.step(0x325b, 4); // ld a,e -- the running total back into A
    regs.xor(mem.read8(regs.hl));
    m.step(0x325c, 7); // xor (hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x325d, 6); // inc hl
    regs.bc = (regs.bc - 1) & 0xffff; // dec bc -- NO flags
    m.step(0x325e, 6); // dec bc
    regs.e = regs.a;
    m.step(0x325f, 4); // ld e,a -- park the total
    regs.a = regs.c;
    m.step(0x3260, 4); // ld a,c
    regs.or(regs.b);
    m.step(0x3261, 4); // or b -- Z only when BC reached zero
    if (regs.fNZ) {
      m.step(0x325a, 12); // jr nz,0x325a taken
      continue;
    }
    m.step(0x3263, 7); // jr nz NOT taken
    break;
  }

  regs.a = 0x52;
  m.step(0x3265, 7); // ld a,0x52
  regs.add(regs.e);
  m.step(0x3266, 4); // add a,e -- zero on a genuine image (E == 0xAE)

  if (regs.fNZ) {
    m.step(0x0f11, 10); // jp nz,0x0f11 TAKEN -- checksum failed
    return m.call(0x0f11);
  }
  m.step(0x3269, 10); // jp nz NOT taken -- the ROM checks out

  m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL jump, nothing pushed
  return m.call(0x0f1a);
}
