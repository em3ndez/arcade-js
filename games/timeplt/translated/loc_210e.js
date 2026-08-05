// SPDX-License-Identifier: GPL-3.0-only

// loc_210e  (ROM 0x210E-0x2149)
export function loc_210e(m) {
  const { regs, mem } = m;

  regs.hl = 0xadf3;
  m.step(0x2111, 10); // ld hl,0xadf3
  regs.exDeHl();
  m.step(0x2112, 4); // ex de,hl -- DE = 0xadf3
  regs.a = mem.read8(0xad14);
  m.step(0x2115, 13); // ld a,(0xad14)
  regs.and(regs.a);
  m.step(0x2116, 4); // and a

  if (regs.fZ) {
    m.step(0x2140, 12); // jr z,0x2140 taken -- (0xad14) == 0
    regs.hl = 0x218c;
    m.step(0x2143, 10); // ld hl,0x218c
    m.step(0x2123, 12); // jr 0x2123
  } else {
    m.step(0x2118, 7); // jr z not taken
    regs.cp(0x03);
    m.step(0x211a, 7); // cp 0x03
    if (regs.fZ) {
      m.step(0x2140, 12); // jr z,0x2140 taken -- (0xad14) == 3
      regs.hl = 0x218c;
      m.step(0x2143, 10); // ld hl,0x218c
      m.step(0x2123, 12); // jr 0x2123
    } else {
      m.step(0x211c, 7); // jr z not taken
      regs.cp(0x01);
      m.step(0x211e, 7); // cp 0x01
      if (regs.fZ) {
        m.step(0x2145, 12); // jr z,0x2145 taken -- (0xad14) == 1
        regs.hl = 0x2251;
        m.step(0x2148, 10); // ld hl,0x2251
        m.step(0x2123, 12); // jr 0x2123
      } else {
        m.step(0x2120, 7); // jr z not taken
        regs.hl = 0x22fa;
        m.step(0x2123, 10); // ld hl,0x22fa
      }
    }
  }

  regs.a = mem.read8(regs.hl);
  m.step(0x2124, 7); // ld a,(hl) -- the script's leading byte
  regs.a = regs.inc8(regs.a);
  m.step(0x2125, 4); // inc a
  mem.write8(0xadf2, regs.a);
  m.step(0x2128, 13); // ld (0xadf2),a -- the script counter
  regs.exDeHl();
  m.step(0x2129, 4); // ex de,hl -- HL = 0xadf3, DE = the script pointer
  mem.write8(regs.hl, regs.e);
  m.step(0x212a, 7); // ld (hl),e
  regs.l = regs.inc8(regs.l);
  m.step(0x212b, 4); // inc l -- 8-bit, H untouched
  mem.write8(regs.hl, regs.d);
  m.step(0x212c, 7); // ld (hl),d

  regs.hl = 0xadfb;
  m.step(0x212f, 10); // ld hl,0xadfb
  regs.a = mem.read8(regs.hl);
  m.step(0x2130, 7); // ld a,(hl)
  regs.cp(0xfd);
  m.step(0x2132, 7); // cp 0xfd
  if (regs.fNZ) {
    m.step(0x213d, 10); // jp nz,0x213d
    m.step(0x2251, 10); // jp 0x2251 -- into a data table; taken when the 0xA5DC tile readback fails
    return m.call(0x2251);
  }
  m.step(0x2135, 10); // jp nz not taken

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2136, 6); // inc hl -- 0xadfc
  regs.a = mem.read8(regs.hl);
  m.step(0x2137, 7); // ld a,(hl)
  regs.cp(0x10);
  m.step(0x2139, 7); // cp 0x10
  if (regs.fZ) {
    m.ret(11); // ret z taken
    return;
  }
  m.step(0x213a, 5); // ret z not taken
  regs.cp(0x05);
  m.step(0x213c, 7); // cp 0x05
  if (regs.fZ) {
    m.ret(11); // ret z taken
    return;
  }
  m.step(0x213d, 5); // ret z not taken

  m.step(0x2251, 10); // jp 0x2251 -- into a data table; taken when the 0xA5DC tile readback fails
  return m.call(0x2251);
}
