// SPDX-License-Identifier: GPL-3.0-only

// loc_19da  (ROM 0x19DA–0x19EF)
export function loc_19da(m) {
  const { regs, mem } = m;

  regs.hl = 0xa2bc;
  m.step(0x19dd, 10); // ld hl,0xa2bc
  regs.b = 0x0d;
  m.step(0x19df, 7); // ld b,0x0d

  do {
    regs.a = mem.read8(regs.hl);
    m.step(0x19e0, 7); // ld a,(hl)
    regs.cp(0x10);
    m.step(0x19e2, 7); // cp 0x10
    if (regs.fZ) {
      m.step(0x19e9, 12); // jr z,0x19e9
    } else {
      m.step(0x19e4, 7); // jr z not taken
      regs.cp(0x05);
      m.step(0x19e6, 7); // cp 0x05
      if (regs.fNZ) {
        m.step(0x49fa, 10); // jp nz,0x49fa -- TAIL, does not return here
        return m.call(0x49fa);
      }
      m.step(0x19e9, 10); // jp nz not taken
    }

    regs.de = 0xffe0;
    m.step(0x19ec, 10); // ld de,0xffe0
    regs.addHl(regs.de);
    m.step(0x19ed, 11); // add hl,de -- HL -= 0x20
    regs.djnz(); // djnz -- no flags
    m.step(regs.b !== 0 ? 0x19df : 0x19ef, regs.b !== 0 ? 13 : 8); // djnz 0x19df
  } while (regs.b !== 0);

  m.ret(); // 0x19ef
}
