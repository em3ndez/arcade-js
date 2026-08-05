// SPDX-License-Identifier: GPL-3.0-only

// loc_074b  (ROM 0x074B-0x0773, Time Pilot)
export function loc_074b(m) {
  const { regs, mem } = m;

  regs.b = 0x00;
  m.step(0x074d, 7); // ld b,0x00 -- 256 iterations
  regs.hl = 0x4aa0;
  m.step(0x0750, 10); // ld hl,0x4aa0
  regs.xor(regs.a);
  m.step(0x0751, 4); // xor a -- running sum = 0

  for (;;) {
    regs.add(mem.read8(regs.hl));
    m.step(0x0752, 7); // add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0753, 6); // inc hl
    if (regs.djnz() !== 0) {
      m.step(0x0751, 13); // djnz 0x0751 taken
      continue;
    }
    m.step(0x0755, 8); // djnz NOT taken
    break;
  }

  regs.sub(0xb8);
  m.step(0x0757, 7); // sub 0xb8 -- Z iff the sum came out 0xB8

  if (regs.fNZ) {
    m.step(0x08fa, 10); // jp nz,0x08fa -- checksum FAILED
    return m.call(0x08fa);
  }
  m.step(0x075a, 10); // jp nz NOT taken (jp costs 10 either way)

  regs.a = mem.read8(0xad0c);
  m.step(0x075d, 13); // ld a,(0xad0c)
  regs.cp(0x05);
  m.step(0x075f, 7); // cp 0x05 -- Z iff it already held 5
  m.push16(regs.af);
  m.step(0x0760, 11); // push af -- park the comparison

  regs.a = 0x05;
  m.step(0x0762, 7); // ld a,0x05
  mem.write8(0xad0c, regs.a);
  m.step(0x0765, 13); // ld (0xad0c),a
  regs.a = 0xf1;
  m.step(0x0767, 7); // ld a,0xf1
  mem.write8(0xad0b, regs.a);
  m.step(0x076a, 13); // ld (0xad0b),a

  m.push16(0x076d);
  m.step(0x01e1, 17); // call 0x01e1
  m.call(0x01e1);

  regs.af = m.pop16();
  m.step(0x076e, 10); // pop af -- the cp 0x05 flags are back

  if (regs.fZ) {
    m.push16(0x0771);
    m.step(0x0f1a, 17); // call z,0x0f1a taken
    m.call(0x0f1a);
  } else {
    m.step(0x0771, 10); // call z,0x0f1a NOT taken
  }

  m.step(0x0f1a, 10); // jp 0x0f1a
  return m.call(0x0f1a);
}
