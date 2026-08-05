// SPDX-License-Identifier: GPL-3.0-only

// loc_4a0f  (ROM 0x4A0F-0x4A9C, Time Pilot)
export function loc_4a0f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x3213); // ROM constant
  m.step(0x4a12, 13); // ld a,(0x3213)
  mem.write8(0xa9f0, regs.a);
  m.step(0x4a15, 13); // ld (0xa9f0),a

  regs.a = 0x00;
  m.step(0x4a17, 7); // ld a,0x00
  mem.write8(0xa9f1, regs.a);
  m.step(0x4a1a, 13); // ld (0xa9f1),a

  regs.a = 0xff;
  m.step(0x4a1c, 7); // ld a,0xff
  mem.write8(0xa9f2, regs.a);
  m.step(0x4a1f, 13); // ld (0xa9f2),a

  regs.a = 0x04;
  m.step(0x4a21, 7); // ld a,0x04
  mem.write8(0xa9f3, regs.a);
  m.step(0x4a24, 13); // ld (0xa9f3),a

  regs.a = 0xff;
  m.step(0x4a26, 7); // ld a,0xff
  mem.write8(0xa9f4, regs.a);
  m.step(0x4a29, 13); // ld (0xa9f4),a

  regs.a = 0x08;
  m.step(0x4a2b, 7); // ld a,0x08
  mem.write8(0xa9f6, regs.a);
  m.step(0x4a2e, 13); // ld (0xa9f6),a

  regs.hl = 0x56f1;
  m.step(0x4a31, 10); // ld hl,0x56f1
  mem.write16(0xa9f7, regs.hl);
  m.step(0x4a34, 16); // ld (0xa9f7),hl -- a ROM pointer parked in work RAM

  regs.b = 0x0d;
  m.step(0x4a36, 7); // ld b,0x0d
  regs.hl = 0xa400;
  m.step(0x4a39, 10); // ld hl,0xa400
  regs.c = 0x14;
  m.step(0x4a3b, 7); // ld c,0x14

  do {
    mem.write8(regs.hl, regs.c);
    m.step(0x4a3c, 7); // ld (hl),c
    regs.hl = (regs.hl + 1) & 0xffff; // 16-bit INC: no flags
    m.step(0x4a3d, 6); // inc hl
    regs.djnz(); // djnz -- no flags
    m.step(regs.b !== 0 ? 0x4a3b : 0x4a3f, regs.b !== 0 ? 13 : 8); // djnz 0x4a3b
  } while (regs.b !== 0);

  regs.a = 0x00;
  m.step(0x4a41, 7); // ld a,0x00
  mem.write8(regs.hl, regs.a);
  m.step(0x4a42, 7); // ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4a43, 6); // inc hl
  mem.write8(regs.hl, regs.a);
  m.step(0x4a44, 7); // ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4a45, 6); // inc hl

  regs.b = 0x0d;
  m.step(0x4a47, 7); // ld b,0x0d

  do {
    mem.write8(regs.hl, regs.c);
    m.step(0x4a48, 7); // ld (hl),c
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4a49, 6); // inc hl
    regs.djnz();
    m.step(regs.b !== 0 ? 0x4a47 : 0x4a4b, regs.b !== 0 ? 13 : 8); // djnz 0x4a47
  } while (regs.b !== 0);

  regs.a = 0x0e;
  m.step(0x4a4d, 7); // ld a,0x0e
  regs.b = 0x04;
  m.step(0x4a4f, 7); // ld b,0x04

  do {
    mem.write8(regs.hl, regs.a);
    m.step(0x4a50, 7); // ld (hl),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4a51, 6); // inc hl
    regs.djnz();
    m.step(regs.b !== 0 ? 0x4a4f : 0x4a53, regs.b !== 0 ? 13 : 8); // djnz 0x4a4f
  } while (regs.b !== 0);

  regs.hl = 0xa7b1;
  m.step(0x4a56, 10); // ld hl,0xa7b1
  regs.h = regs.res(2, regs.h); // res/set touch NO flags
  m.step(0x4a58, 8); // res 2,h -- 0xa7b1 -> 0xa3b1, the colour cell

  regs.a = mem.read8(0xad0c);
  m.step(0x4a5b, 13); // ld a,(0xad0c)
  regs.c = regs.a;
  m.step(0x4a5c, 4); // ld c,a -- the base colour, reused throughout
  regs.a = 0xa0;
  m.step(0x4a5e, 7); // ld a,0xa0
  regs.add(regs.c);
  m.step(0x4a5f, 4); // add a,c

  m.push16(0x4a62);
  m.step(0x1319, 17); // call 0x1319 -- fills 13 cells, and leaves DE = 0xffe0
  m.call(0x1319);

  regs.hl = 0xa5d1;
  m.step(0x4a65, 10); // ld hl,0xa5d1
  regs.h = regs.res(2, regs.h);
  m.step(0x4a67, 8); // res 2,h -- 0xa1d1
  regs.a = 0x20;
  m.step(0x4a69, 7); // ld a,0x20
  regs.add(regs.c);
  m.step(0x4a6a, 4); // add a,c

  m.push16(0x4a6d);
  m.step(0x1319, 17); // call 0x1319
  m.call(0x1319);

  regs.hl = 0xa610;
  m.step(0x4a70, 10); // ld hl,0xa610
  regs.h = regs.res(2, regs.h);
  m.step(0x4a72, 8); // res 2,h -- 0xa210
  regs.a = 0xa0;
  m.step(0x4a74, 7); // ld a,0xa0
  regs.add(regs.c);
  m.step(0x4a75, 4); // add a,c
  mem.write8(regs.hl, regs.a);
  m.step(0x4a76, 7); // ld (hl),a
  regs.addHl(regs.de);
  m.step(0x4a77, 11); // add hl,de -- DE is 0xffe0 from 0x1319, so HL -= 0x20
  regs.a = 0x20;
  m.step(0x4a79, 7); // ld a,0x20
  regs.add(regs.c);
  m.step(0x4a7a, 4); // add a,c
  mem.write8(regs.hl, regs.a);
  m.step(0x4a7b, 7); // ld (hl),a

  regs.hl = 0xa612;
  m.step(0x4a7e, 10); // ld hl,0xa612
  regs.h = regs.res(2, regs.h);
  m.step(0x4a80, 8); // res 2,h -- 0xa212
  regs.a = 0xe0;
  m.step(0x4a82, 7); // ld a,0xe0
  regs.add(regs.c);
  m.step(0x4a83, 4); // add a,c
  mem.write8(regs.hl, regs.a);
  m.step(0x4a84, 7); // ld (hl),a
  regs.addHl(regs.de);
  m.step(0x4a85, 11); // add hl,de
  regs.a = 0x60;
  m.step(0x4a87, 7); // ld a,0x60
  regs.add(regs.c);
  m.step(0x4a88, 4); // add a,c
  mem.write8(regs.hl, regs.a);
  m.step(0x4a89, 7); // ld (hl),a

  regs.hl = 0xa611;
  m.step(0x4a8c, 10); // ld hl,0xa611
  regs.h = regs.res(2, regs.h);
  m.step(0x4a8e, 8); // res 2,h -- 0xa211
  regs.a = 0xa0;
  m.step(0x4a90, 7); // ld a,0xa0
  regs.add(regs.c);
  m.step(0x4a91, 4); // add a,c
  mem.write8(regs.hl, regs.a);
  m.step(0x4a92, 7); // ld (hl),a
  regs.addHl(regs.de);
  m.step(0x4a93, 11); // add hl,de
  regs.a = 0x20;
  m.step(0x4a95, 7); // ld a,0x20
  regs.add(regs.c);
  m.step(0x4a96, 4); // add a,c
  mem.write8(regs.hl, regs.a);
  m.step(0x4a97, 7); // ld (hl),a

  m.push16(0x4a9a);
  m.step(0x339c, 17); // call 0x339c
  m.call(0x339c);

  m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL, advance the self-test sequencer
  return m.call(0x0f1a);
}
