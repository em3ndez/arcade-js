// SPDX-License-Identifier: GPL-3.0-only

// loc_382d  (ROM 0x382D–0x3846)
export function loc_382d(m) {
  const { regs, mem } = m;

  m.push16(0x3830);
  m.step(0x4b4b, 17); // call 0x4b4b -- RNG
  m.call(0x4b4b);

  regs.hl = 0xacc4;
  m.step(0x3833, 10); // ld hl,0xacc4
  regs.cp(mem.read8(regs.hl));
  m.step(0x3834, 7); // cp (hl)
  if (regs.fNC) {
    m.step(0x3842, 12); // jr nc,0x3842 TAKEN
    regs.and(0x03);
    m.step(0x3844, 7); // and 0x03
    regs.add(0x05);
    m.step(0x3846, 7); // add a,0x05
    m.ret(); // 3846
    return;
  }
  m.step(0x3836, 7); // jr nc NOT taken -- below the threshold

  regs.hl = 0xa9cf;
  m.step(0x3839, 10); // ld hl,0xa9cf
  regs.a = mem.read8(regs.hl);
  m.step(0x383a, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a);
  m.step(0x383b, 4); // inc a
  regs.cp(0x05);
  m.step(0x383d, 7); // cp 0x05
  if (regs.fC) {
    m.step(0x3840, 12); // jr c,0x3840 TAKEN -- still below 5
  } else {
    m.step(0x383f, 7); // jr c NOT taken
    regs.xor(regs.a);
    m.step(0x3840, 4); // xor a -- wrap to 0
  }

  mem.write8(regs.hl, regs.a);
  m.step(0x3841, 7); // ld (hl),a
  m.ret(); // 3841
}
