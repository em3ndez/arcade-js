// SPDX-License-Identifier: GPL-3.0-only

// loc_07e6  (ROM 0x07E6-0x0808, Time Pilot)
export function loc_07e6(m) {
  const { regs, mem } = m;

  m.push16(0x07e9);
  m.step(0x0b06, 17); // call 0x0b06
  m.call(0x0b06);

  m.push16(0x07ec);
  m.step(0x0b39, 17); // call 0x0b39
  m.call(0x0b39);

  regs.hl = 0xa61c;
  m.step(0x07ef, 10); // ld hl,0xa61c
  regs.de = 0xabfe;
  m.step(0x07f2, 10); // ld de,0xabfe

  m.push16(0x07f5);
  m.step(0x1afc, 17); // call 0x1afc
  m.call(0x1afc);

  regs.a = mem.read8(0xa9ae);
  m.step(0x07f8, 13); // ld a,(0xa9ae) -- the complemented IN0 latch
  regs.bit(3, regs.a);
  m.step(0x07fa, 8); // bit 3,a -- Z = !bit, C preserved

  if (regs.fNZ) {
    m.step(0x3215, 10); // jp nz,0x3215 taken
    return m.call(0x3215);
  }
  m.step(0x07fd, 10); // jp nz NOT taken (jp costs 10 either way)

  regs.a = mem.read8(0xa986);
  m.step(0x0800, 13); // ld a,(0xa986)
  regs.a = regs.dec8(regs.a);
  m.step(0x0801, 4); // dec a

  if (regs.fZ) {
    m.ret(11); // 0801  ret z (taken) -- (0xa986) held 1
    return;
  }
  m.step(0x0802, 5); // ret z (not taken)

  regs.de = 0x0119;
  m.step(0x0805, 10); // ld de,0x0119

  m.push16(0x0806);
  m.step(0x0038, 11); // rst 0x38 -- queue (0x01,0x19)
  m.call(0x0038);

  m.step(0x0f1a, 10); // jp 0x0f1a
  return m.call(0x0f1a);
}
