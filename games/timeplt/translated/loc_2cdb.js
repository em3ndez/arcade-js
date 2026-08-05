// SPDX-License-Identifier: GPL-3.0-only

// loc_2cdb  (ROM 0x2CDB–0x2CF4)
export function loc_2cdb(m) {
  const { regs, mem } = m;

  m.push16(0x2cde);
  m.step(0x01c2, 17); // call 0x01c2
  m.call(0x01c2);

  if (regs.fNZ) {
    m.ret(11); // ret nz
    return;
  }
  m.step(0x2cdf, 5); // ret nz not taken

  regs.bc = 0x0004; // B = 0x00, C = 0x04
  m.step(0x2ce2, 10); // ld bc,0x0004
  regs.hl = 0x4980;
  m.step(0x2ce5, 10); // ld hl,0x4980
  regs.sub(regs.a); // A = 0
  m.step(0x2ce6, 4); // sub a

  do {
    do {
      regs.xor(mem.read8(regs.hl));
      m.step(0x2ce7, 7); // xor (hl)
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x2ce8, 6); // inc hl
      regs.djnz(); // djnz -- no flags
      m.step(regs.b !== 0 ? 0x2ce6 : 0x2cea, regs.b !== 0 ? 13 : 8); // djnz 0x2ce6
    } while (regs.b !== 0);

    regs.c = regs.dec8(regs.c);
    m.step(0x2ceb, 4); // dec c
    m.step(regs.fNZ ? 0x2ce6 : 0x2ced, regs.fNZ ? 12 : 7); // jr nz,0x2ce6
  } while (regs.fNZ);

  regs.add(0xbd);
  m.step(0x2cef, 7); // add a,0xbd
  if (regs.fNZ) {
    m.step(0x0f11, 10); // jp nz,0x0f11 -- TAIL
    return m.call(0x0f11);
  }
  m.step(0x2cf2, 10); // jp nz not taken

  m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL
  return m.call(0x0f1a);
}
