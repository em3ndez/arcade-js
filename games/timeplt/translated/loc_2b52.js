// SPDX-License-Identifier: GPL-3.0-only

// loc_2b52  (ROM 0x2B52-0x2B5F)
export function loc_2b52(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;

  regs.decMem8(mem, IX(0x0e)); // dec (ix+0x0e)
  m.step(0x2b55, 23); // dec (ix+0x0e)

  if (regs.fZ) {
    m.step(0x2b58, 12); // jr z,0x2b58 TAKEN -- the counter expired
  } else {
    m.step(0x2b57, 7); // jr z NOT taken
    m.ret(); // 2b57
    return;
  }

  regs.incMem8(mem, IX(0x00)); // inc (ix+0x00)
  m.step(0x2b5b, 23); // inc (ix+0x00)
  mem.write8(IX(0x0e), 0x80);
  m.step(0x2b5f, 19); // ld (ix+0x0e),0x80
  m.ret(); // 2b5f
}
