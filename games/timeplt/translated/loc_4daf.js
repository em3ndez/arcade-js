// SPDX-License-Identifier: GPL-3.0-only

// loc_4daf  (ROM 0x4DAF-0x4DCE, Time Pilot)
export function loc_4daf(m) {
  const { regs, mem } = m;

  regs.a = regs.b;
  m.step(0x4db0, 4); // ld a,b
  regs.add(0x03);
  m.step(0x4db2, 7); // add a,0x03
  mem.write8(regs.de, regs.a);
  m.step(0x4db3, 7); // ld (de),a
  regs.a = regs.dec8(regs.a);
  m.step(0x4db4, 4); // dec a
  regs.de = (regs.de - 1) & 0xffff;
  m.step(0x4db5, 6); // dec de -- 16-bit, no flags
  mem.write8(regs.de, regs.a);
  m.step(0x4db6, 7); // ld (de),a
  m.push16(0x4db7);
  m.step(0x0020, 11); // rst 0x20 -- DE -= 0x20
  m.call(0x0020);

  regs.a = regs.b;
  m.step(0x4db8, 4); // ld a,b
  mem.write8(regs.de, regs.a);
  m.step(0x4db9, 7); // ld (de),a
  regs.a = regs.inc8(regs.a);
  m.step(0x4dba, 4); // inc a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x4dbb, 6); // inc de -- 16-bit, no flags
  mem.write8(regs.de, regs.a);
  m.step(0x4dbc, 7); // ld (de),a

  regs.hl = 0xfc00;
  m.step(0x4dbf, 10); // ld hl,0xfc00
  regs.addHl(regs.de);
  m.step(0x4dc0, 11); // add hl,de -- HL = DE - 0x0400
  m.push16(0x4dc1);
  m.step(0x0020, 11); // rst 0x20 -- DE -= 0x20
  m.call(0x0020);

  mem.write8(regs.hl, regs.c);
  m.step(0x4dc2, 7); // ld (hl),c
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x4dc3, 6); // dec hl -- 16-bit, no flags
  mem.write8(regs.hl, regs.c);
  m.step(0x4dc4, 7); // ld (hl),c
  regs.a = regs.l;
  m.step(0x4dc5, 4); // ld a,l
  regs.add(0x20);
  m.step(0x4dc7, 7); // add a,0x20
  regs.l = regs.a;
  m.step(0x4dc8, 4); // ld l,a
  if (regs.fNC) {
    m.step(0x4dcb, 12); // jr nc,0x4dcb taken
  } else {
    m.step(0x4dca, 7); // jr nc NOT taken
    regs.h = regs.inc8(regs.h);
    m.step(0x4dcb, 4); // inc h -- carry out of L
  }

  mem.write8(regs.hl, regs.c);
  m.step(0x4dcc, 7); // ld (hl),c
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4dcd, 6); // inc hl -- 16-bit, no flags
  mem.write8(regs.hl, regs.c);
  m.step(0x4dce, 7); // ld (hl),c

  m.ret(); // 4dce  ret
}
