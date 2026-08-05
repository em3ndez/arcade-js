// SPDX-License-Identifier: GPL-3.0-only

// loc_4b67  (ROM 0x4B67-0x4B83)
export function loc_4b67(m) {
  const { regs, mem } = m;

  regs.hl = 0x4b84;
  m.step(0x4b6a, 10); // ld hl,0x4b84
  regs.de = 0xab30;
  m.step(0x4b6d, 10); // ld de,0xab30
  regs.bc = 0x0011;
  m.step(0x4b70, 10); // ld bc,0x0011
  m.ldirAt(0x4b70, 0x4b72); // ldir -- 17 bytes ROM -> 0xAB30

  regs.ix = mem.read16(0x086d);
  m.step(0x4b76, 20); // ld ix,(0x086d)
  regs.hl = mem.read16(0x0870);
  m.step(0x4b79, 16); // ld hl,(0x0870)
  regs.a = regs.ix & 0xff;
  m.step(0x4b7b, 8); // ld a,ixl -- flag-neutral
  regs.add((regs.ix >> 8) & 0xff);
  m.step(0x4b7d, 8); // add a,ixh
  regs.add(regs.l);
  m.step(0x4b7e, 4); // add a,l
  regs.add(0x44);
  m.step(0x4b80, 7); // add a,0x44 -- must wrap to 0x00
  if (regs.fNZ) {
    m.step(0x6000, 10); // jp nz,0x6000
    throw new Error(
      "Time Pilot anti-tamper trap at 0x4B80 fired: the checksum over (0x086D)/(0x0870) " +
      "did not come to zero, so the ROM image is not a genuine timeplt dump.",
    );
  }
  m.step(0x4b83, 10); // jp nz not taken -- the ROM checks out
  m.ret(10); // 4b83
}
