// SPDX-License-Identifier: GPL-3.0-only

// loc_083e  (ROM 0x083E-0x086A, Time Pilot)
export function loc_083e(m) {
  const { regs, mem } = m;

  m.push16(0x0841);
  m.step(0x0b39, 17); // call 0x0b39
  m.call(0x0b39);

  m.push16(0x0844);
  m.step(0x0b06, 17); // call 0x0b06
  m.call(0x0b06);

  regs.de = 0x0100;
  m.step(0x0847, 10); // ld de,0x0100
  regs.b = 0x02;
  m.step(0x0849, 7); // ld b,0x02

  for (;;) {
    m.push16(0x084a);
    m.step(0x0038, 11); // rst 0x38 -- push (D,E) into the command ring
    m.call(0x0038);
    regs.e = regs.inc8(regs.e);
    m.step(0x084b, 4); // inc e
    if (regs.djnz() !== 0) {
      m.step(0x0849, 13); // djnz 0x0849 taken
      continue;
    }
    m.step(0x084d, 8); // djnz NOT taken
    break;
  }

  regs.e = regs.inc8(regs.e);
  m.step(0x084e, 4); // inc e
  regs.b = 0x05;
  m.step(0x0850, 7); // ld b,0x05

  for (;;) {
    m.push16(0x0851);
    m.step(0x0038, 11); // rst 0x38
    m.call(0x0038);
    regs.e = regs.inc8(regs.e);
    m.step(0x0852, 4); // inc e
    if (regs.djnz() !== 0) {
      m.step(0x0850, 13); // djnz 0x0850 taken
      continue;
    }
    m.step(0x0854, 8); // djnz NOT taken
    break;
  }

  regs.e = 0x14;
  m.step(0x0856, 7); // ld e,0x14

  m.push16(0x0857);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  regs.e = regs.inc8(regs.e);
  m.step(0x0858, 4); // inc e

  m.push16(0x0859);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  regs.hl = 0x176a;
  m.step(0x085c, 10); // ld hl,0x176a -- the checksummed ROM block
  regs.b = 0x18;
  m.step(0x085e, 7); // ld b,0x18 -- 24 bytes
  regs.xor(regs.a);
  m.step(0x085f, 4); // xor a -- running XOR = 0

  for (;;) {
    regs.xor(mem.read8(regs.hl));
    m.step(0x0860, 7); // xor (hl)
    regs.l = regs.inc8(regs.l); // `inc l`, NOT inc hl -- stays inside the page
    m.step(0x0861, 4); // inc l
    if (regs.djnz() !== 0) {
      m.step(0x085f, 13); // djnz 0x085f taken
      continue;
    }
    m.step(0x0863, 8); // djnz NOT taken
    break;
  }

  regs.sub(0xc9);
  m.step(0x0865, 7); // sub 0xc9 -- Z iff the XOR came out 0xC9

  if (regs.fNZ) {
    m.step(0x08fa, 10); // jp nz,0x08fa -- checksum FAILED
    return m.call(0x08fa);
  }
  m.step(0x0868, 10); // jp nz NOT taken

  m.step(0x0f1a, 10); // jp 0x0f1a -- checksum passed
  return m.call(0x0f1a);
}
