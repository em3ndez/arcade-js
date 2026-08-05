// SPDX-License-Identifier: GPL-3.0-only

// loc_0daf  (ROM 0x0DAF–0x0DCB)
export function loc_0daf(m) {
  const { regs, mem } = m;

  regs.and(0x0f);
  m.step(0x0db1, 7); // and 0x0f

  if (regs.fZ) {
    m.step(0x0db6, 12); // jr z,0x0db6 taken

    regs.a = mem.read8(0x3246);
    m.step(0x0db9, 13); // ld a,(0x3246)
    regs.b = regs.inc8(regs.b);
    m.step(0x0dba, 4); // inc b
    regs.b = regs.dec8(regs.b); // Z now reflects B
    m.step(0x0dbb, 4); // dec b
    if (regs.fZ) {
      m.step(0x0dbe, 12); // jr z,0x0dbe taken -- keep the 0x3246 byte
    } else {
      m.step(0x0dbd, 7); // jr z not taken
      regs.xor(regs.a);
      m.step(0x0dbe, 4); // xor a
    }
  } else {
    m.step(0x0db3, 7); // jr z not taken
    regs.b = regs.inc8(regs.b);
    m.step(0x0db4, 4); // inc b
    m.step(0x0dbe, 12); // jr 0x0dbe
  }

  m.push16(regs.hl);
  m.step(0x0dbf, 11); // push hl
  regs.hl = 0x0dcc;
  m.step(0x0dc2, 10); // ld hl,0x0dcc

  m.push16(0x0dc3);
  m.step(0x0008, 11); // rst 0x08 -- A = table[A] from the 0x0DCC table
  m.call(0x0008);

  regs.hl = m.pop16();
  m.step(0x0dc4, 10); // pop hl
  mem.write8(regs.de, regs.a);
  m.step(0x0dc5, 7); // ld (de),a
  regs.d = regs.res(2, regs.d); // DE -= 0x0400: video RAM -> colour RAM
  m.step(0x0dc7, 8); // res 2,d
  regs.a = regs.c;
  m.step(0x0dc8, 4); // ld a,c
  mem.write8(regs.de, regs.a);
  m.step(0x0dc9, 7); // ld (de),a
  regs.d = regs.set(2, regs.d); // back to video RAM
  m.step(0x0dcb, 8); // set 2,d

  m.ret(); // 0x0dcb
}
