// SPDX-License-Identifier: GPL-3.0-only

// loc_2d3f  (ROM 0x2D3F-0x2D61)
export function loc_2d3f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9c0);
  m.step(0x2d42, 13); // ld a,(0xa9c0)
  regs.and(regs.a);
  m.step(0x2d43, 4); // and a

  if (regs.fNZ) {
    m.step(0x0f1a, 10); // jp nz,0x0f1a taken -- TAIL transfer, nothing pushed
    return m.call(0x0f1a);
  }
  m.step(0x2d46, 10); // jp nz not taken

  m.push16(0x2d49);
  m.step(0x4afb, 17); // call 0x4afb
  m.call(0x4afb);

  regs.de = 0x0108;
  m.step(0x2d4c, 10); // ld de,0x0108

  m.push16(0x2d4d);
  m.step(0x0038, 11); // rst 0x38 -- append DE to the 0xAC00 ring
  m.call(0x0038);

  regs.a = mem.read8(0xa817);
  m.step(0x2d50, 13); // ld a,(0xa817) -- arm 0's checksum result
  regs.and(regs.a);
  m.step(0x2d51, 4); // and a

  if (regs.fNZ) {
    m.step(0x2e3e, 10); // jp nz,0x2e3e taken -- TAIL into the data table, the trap
    return m.call(0x2e3e);
  }
  m.step(0x2d54, 10); // jp nz not taken -- the checksum was zero

  m.push16(0x2d57);
  m.step(0x0b06, 17); // call 0x0b06
  m.call(0x0b06);

  m.push16(0x2d5a);
  m.step(0x0b39, 17); // call 0x0b39
  m.call(0x0b39);

  regs.hl = 0x086b;
  m.step(0x2d5d, 10); // ld hl,0x086b
  regs.b = 0x14;
  m.step(0x2d5f, 7); // ld b,0x14

  m.step(0x43e8, 10); // jp 0x43e8 -- TAIL transfer
  return m.call(0x43e8);
}
