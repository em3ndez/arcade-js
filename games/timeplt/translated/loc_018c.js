// SPDX-License-Identifier: GPL-3.0-only

// loc_018c  (ROM 0x018C-0x0199, Time Pilot)
export function loc_018c(m) {
  const { regs, mem } = m;

  regs.add(regs.a);
  m.step(0x018d, 4); // add a,a -- A = 2*index

  if (regs.fNC) {
    m.step(0x0190, 12); // jr nc,0x0190 taken -- the doubling did not overflow
  } else {
    m.step(0x018f, 7); // jr nc not taken
    regs.h = regs.inc8(regs.h); // inc h -- carry of the doubling into the high byte
    m.step(0x0190, 4);
  }

  regs.add(regs.l);
  m.step(0x0191, 4); // add a,l

  regs.l = regs.a; // ld l,a -- flag-neutral; the carry below is `add a,l`'s
  m.step(0x0192, 4);

  if (regs.fNC) {
    m.step(0x0195, 12); // jr nc,0x0195 taken -- L did not wrap
  } else {
    m.step(0x0194, 7); // jr nc not taken
    regs.h = regs.inc8(regs.h); // inc h
    m.step(0x0195, 4);
  }

  regs.e = mem.read8(regs.hl);
  m.step(0x0196, 7); // ld e,(hl)

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0197, 6); // inc hl

  regs.d = mem.read8(regs.hl);
  m.step(0x0198, 7); // ld d,(hl)

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0199, 6); // inc hl -- HL now points past the word

  m.ret(); // 0199  ret
}
