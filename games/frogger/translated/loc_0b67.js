// SPDX-License-Identifier: GPL-3.0-only

// loc_0b67  (ROM 0x0B67-0x0B94) — draw the credit line. First time only ((0x83B4) still 0) it paints
// a 0x20-cell column at 0xA81F with tile 0x10, then latches (0x83B4)=1. Every call blits the "CREDIT"
// label (rst 0x28), sets (0x803F)=1, and prints the credit count (0x83E1) via loc_0ba0.
export function loc_0b67(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83b4);
  m.step(0x0b6a, 13); // A = (0x83b4) one-time-init flag
  regs.or(regs.a);
  m.step(0x0b6b, 4);
  if (regs.fNZ) {
    m.step(0x0b7e, 12); // jr nz,0x0b7e -- already initialised
    return block_0b7e();
  }
  m.step(0x0b6d, 7);

  regs.a = regs.inc8(regs.a);
  m.step(0x0b6e, 4); // A = 1
  mem.write8(0x83b4, regs.a);
  m.step(0x0b71, 13);
  regs.hl = 0xa81f;
  m.step(0x0b74, 10);
  regs.de = 0x0020;
  m.step(0x0b77, 10); // DE = 0x20 -- one tile row
  regs.bc = 0x2010;
  m.step(0x0b7a, 10); // B=0x20 count, C=0x10 fill tile

  for (;;) {
    // loc_0b7a: clear a 0x20-cell column
    mem.write8(regs.hl, regs.c);
    m.step(0x0b7b, 7);
    regs.addHl(regs.de);
    m.step(0x0b7c, 11);
    if (m.regs.djnz() !== 0) {
      m.step(0x0b7a, 13);
      continue;
    }
    m.step(0x0b7e, 8);
    break;
  }

  return block_0b7e();

  function block_0b7e() {
    regs.de = 0x2f68;
    m.step(0x0b81, 10);
    regs.hl = 0xa97f;
    m.step(0x0b84, 10);
    regs.b = 0x06;
    m.step(0x0b86, 7);
    m.push16(0x0b87);
    m.step(0x0028, 11); // rst 0x28 -- blit the "CREDIT" label
    m.call(0x0028);

    regs.a = 0x01;
    m.step(0x0b89, 7);
    mem.write8(0x803f, regs.a);
    m.step(0x0b8c, 13);
    regs.hl = 0xa89f;
    m.step(0x0b8f, 10);
    regs.a = mem.read8(0x83e1);
    m.step(0x0b92, 13); // A = (0x83e1) credit count (BCD)

    m.step(0x0ba0, 10); // jp 0x0ba0 -- print the two credit digits
    return m.call(0x0ba0);
  }
}
